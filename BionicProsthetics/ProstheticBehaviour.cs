using System.Collections.Generic;
using UnityEngine;

namespace BionicProsthetics
{
    /// <summary>Which missing body part a prosthetic replaces.</summary>
    public enum ProstheticSlot
    {
        Forearm,  // replaces LowerArm; mounts on an UpperArm stump or a prosthetic upper arm
        FullArm,  // replaces the whole arm, mounts on the UpperBody (shoulder)
        LowerLeg, // replaces LowerLeg + Foot; mounts on an UpperLeg stump or a prosthetic thigh
        FullLeg,  // replaces the whole leg, mounts on the LowerBody (hip)
        UpperArm, // modular upper arm: mounts on the UpperBody, takes any Forearm prosthetic at its elbow
        UpperLeg  // modular thigh: mounts on the LowerBody, takes any LowerLeg prosthetic at its knee
    }

    /// <summary>
    /// Core prosthetic logic. Touch a prosthetic to a stump (or to a modular upper arm / thigh) and it
    /// snaps on with a powered hinge joint, sized to match the wearer and moving within the healthy limb's range.
    /// </summary>
    public class ProstheticBehaviour : MonoBehaviour
    {
        public ProstheticSlot Slot;
        public string DisplayName = "Prosthetic";
        /// <summary>Socket joint point, in texture pixels from the top-left.</summary>
        public Vector2 AttachPixel;
        /// <summary>Business end (hand, sole, muzzle...), in texture pixels from the top-left.</summary>
        public Vector2 TipPixel;
        /// <summary>Modular upper arms / thighs: where the next piece plugs in (elbow / knee), in texture pixels.</summary>
        public Vector2 MountPixel;
        /// <summary>Locks the joint nearly rigid, like a real peg leg or running blade.</summary>
        public bool LockJoint;

        public bool Attached { get { return joint != null; } }
        /// <summary>What this is fitted to: a LimbBehaviour stump or another (modular) ProstheticBehaviour.</summary>
        public Component Anchor { get; private set; }
        public ProstheticBehaviour AnchorProsthetic { get { return Anchor as ProstheticBehaviour; } }
        /// <summary>The person this is (directly or through a chain of prosthetics) attached to, if any.</summary>
        public PersonBehaviour Wearer
        {
            get
            {
                ProstheticBehaviour mount = AnchorProsthetic;
                if (mount != null) return mount.Wearer;
                return Attached ? directWearer : null;
            }
        }
        public string ReplacedLimb { get; private set; }
        public Rigidbody2D Body { get; private set; }
        public SpriteRenderer Renderer { get; private set; }
        /// <summary>Two-piece limbs only: the separate lower segment (forearm or shin) hinged at the elbow/knee.</summary>
        public Rigidbody2D SegmentBody { get; private set; }
        public SpriteRenderer SegmentRenderer { get; private set; }
        /// <summary>The body that carries the tip: the lower segment on two-piece limbs, otherwise this one.</summary>
        public Rigidbody2D TipBody { get { return SegmentBody != null ? SegmentBody : Body; } }

        public bool IsMount { get { return Slot == ProstheticSlot.UpperArm || Slot == ProstheticSlot.UpperLeg; } }
        /// <summary>"Front", "" (back) or null when not fitted to a side of anyone.</summary>
        public string Side
        {
            get
            {
                if (ReplacedLimb == null) return null;
                return ReplacedLimb.EndsWith("Front") ? "Front" : "";
            }
        }
        public Vector2 MountLocal { get { return PixelToLocal(MountPixel); } }
        /// <summary>Texture row just under a socket's rim; the hinge point when plugged into a modular mount.</summary>
        const float MountedRimRow = 2f;
        /// <summary>The game's Brick prefab, used so lower segments are real, grabbable game objects.</summary>
        public static GameObject SegmentPrefab;

        HingeJoint2D joint;
        PersonBehaviour directWearer;
        float motorTorque;
        readonly Servo socketServo = new Servo();

        GameObject segment;
        HingeJoint2D midJoint;
        Vector2 jointPixel;
        Vector2 segmentJointPixel;
        HingeJoint2D twinMidJoint;
        bool twinMidInverted;
        float midTorque;
        float midConventionVotes;
        readonly Servo midServo = new Servo();
        float nextAttachTime;
        float nextProbeTime;
        float lastContactTime = -10f;
        float nextHintTime;
        AudioSource audioSource;
        int baseLayerId;
        int baseOrder;
        readonly List<KeyValuePair<Collider2D, Collider2D>> ignoredPairs = new List<KeyValuePair<Collider2D, Collider2D>>();
        readonly List<KeyValuePair<SpriteRenderer, int>> overlays = new List<KeyValuePair<SpriteRenderer, int>>();

        bool IsArm { get { return Slot == ProstheticSlot.Forearm || Slot == ProstheticSlot.FullArm || Slot == ProstheticSlot.UpperArm; } }
        /// <summary>Mounted on the torso (shoulder / hip) rather than on a stump further down the limb.</summary>
        bool IsTorsoMounted { get { return Slot != ProstheticSlot.Forearm && Slot != ProstheticSlot.LowerLeg; } }

        void Awake()
        {
            Body = GetComponent<Rigidbody2D>();
            Renderer = GetComponent<SpriteRenderer>();
            audioSource = GetComponent<AudioSource>();
            AudioSource template = audioSource;
            audioSource = gameObject.AddComponent<AudioSource>();
            audioSource.playOnAwake = false;
            audioSource.spatialBlend = 0f;
            if (template != null) audioSource.outputAudioMixerGroup = template.outputAudioMixerGroup;
        }

        void Start()
        {
            // A copied prosthetic can inherit a joint to somebody else's stump; drop it.
            foreach (HingeJoint2D stray in GetComponents<HingeJoint2D>())
            {
                if (stray != joint && stray.connectedBody != null && stray.connectedBody.GetComponent<LimbBehaviour>() != null)
                    Destroy(stray);
            }
        }

        // ------------------------------------------------------------ geometry helpers

        public Vector2 PixelToLocal(Vector2 px)
        {
            return PixelToLocal(Renderer.sprite, px);
        }

        static Vector2 PixelToLocal(Sprite s, Vector2 px)
        {
            float ppu = s.pixelsPerUnit;
            return new Vector2((px.x + 0.5f - s.pivot.x) / ppu, (s.rect.height - px.y - 0.5f - s.pivot.y) / ppu);
        }

        public Vector2 AttachWorld { get { return transform.TransformPoint(PixelToLocal(AttachPixel)); } }
        public Vector2 TipWorld
        {
            get
            {
                if (segment != null) return segment.transform.TransformPoint(PixelToLocal(SegmentRenderer.sprite, TipPixel));
                return transform.TransformPoint(PixelToLocal(TipPixel));
            }
        }
        /// <summary>World direction pointing from the socket (or elbow/knee) towards the extremity.</summary>
        public Vector2 AxisDown { get { return -(Vector2)(segment != null ? segment.transform.up : transform.up); } }
        /// <summary>World length from socket to tip; a handy size reference for effects.</summary>
        public float WorldLength { get { return Mathf.Max(0.05f, Vector2.Distance(AttachWorld, TipWorld)); } }
        public int CollisionMask { get { return Physics2D.GetLayerCollisionMask(gameObject.layer); } }

        // ------------------------------------------------------------ wearer helpers

        /// <summary>The prosthetic a collider belongs to (its main body or its lower segment), if any.</summary>
        static ProstheticBehaviour PartOwner(Collider2D col)
        {
            ProstheticBehaviour owner = col.GetComponentInParent<ProstheticBehaviour>();
            if (owner == null && col.attachedRigidbody != null)
            {
                SegmentLink link = col.attachedRigidbody.GetComponent<SegmentLink>();
                if (link != null) owner = link.Owner;
            }
            return owner;
        }

        /// <summary>True for this prosthetic, its own assembly, the wearer's limbs and their other prosthetics.</summary>
        public bool IsOwnBody(Collider2D col)
        {
            if (col == null) return false;
            if (col.attachedRigidbody == Body || col.transform.IsChildOf(transform)) return true;
            if (SegmentBody != null && col.attachedRigidbody == SegmentBody) return true;
            ProstheticBehaviour other = PartOwner(col);
            if (other != null && (other == AnchorProsthetic || other.AnchorProsthetic == this)) return true;
            PersonBehaviour wearer = Wearer;
            if (wearer == null) return false;
            if (col.transform.IsChildOf(wearer.transform)) return true;
            return other != null && other.Wearer == wearer;
        }

        /// <summary>Everything that should move together when the prosthetic launches its wearer.</summary>
        public List<Rigidbody2D> WearerBodies()
        {
            List<Rigidbody2D> list = new List<Rigidbody2D>();
            list.Add(Body);
            if (SegmentBody != null) list.Add(SegmentBody);
            PersonBehaviour wearer = Wearer;
            if (wearer != null) list.AddRange(wearer.GetComponentsInChildren<Rigidbody2D>());
            foreach (ProstheticBehaviour p in FindObjectsOfType<ProstheticBehaviour>())
            {
                if (p == this) continue;
                bool sameAssembly = (wearer != null && p.Wearer == wearer) || p == AnchorProsthetic || p.AnchorProsthetic == this;
                if (!sameAssembly) continue;
                if (p.Body != null) list.Add(p.Body);
                if (p.SegmentBody != null) list.Add(p.SegmentBody);
            }
            return list;
        }

        /// <summary>Is the tip touching the ground or anything else that isn't part of the wearer?</summary>
        public bool Grounded
        {
            get
            {
                if (Time.time - lastContactTime < 0.15f) return true;
                foreach (Collider2D c in Physics2D.OverlapCircleAll(TipWorld, WorldLength * 0.12f, CollisionMask))
                {
                    if (!c.isTrigger && !IsOwnBody(c)) return true;
                }
                return false;
            }
        }

        public void Play(AudioClip clip, float volume = 1f)
        {
            if (clip != null) audioSource.PlayOneShot(clip, volume);
        }

        public AudioSource AudioTemplate { get { return audioSource; } }

        /// <summary>Child renderers (beams, glows) that should follow this prosthetic's sorting.</summary>
        public void RegisterOverlay(SpriteRenderer overlay, int orderOffset)
        {
            overlays.Add(new KeyValuePair<SpriteRenderer, int>(overlay, orderOffset));
            overlay.sortingLayerID = Renderer.sortingLayerID;
            overlay.sortingOrder = Renderer.sortingOrder + orderOffset;
        }

        void SetSorting(int layerId, int order)
        {
            Renderer.sortingLayerID = layerId;
            Renderer.sortingOrder = order;
            foreach (KeyValuePair<SpriteRenderer, int> o in overlays)
            {
                if (o.Key == null) continue;
                o.Key.sortingLayerID = layerId;
                o.Key.sortingOrder = order + o.Value;
            }
        }

        // ------------------------------------------------------------ attaching

        void OnCollisionEnter2D(Collision2D collision)
        {
            OnPartContact(collision.collider, collision.relativeVelocity.magnitude);
        }

        void OnCollisionStay2D(Collision2D collision)
        {
            OnPartContact(collision.collider, 0f);
        }

        /// <summary>
        /// Contact on any part of the prosthetic (the segment reports through here too). impactSpeed is the
        /// closing speed of a fresh hit, or 0 for something that is just resting against it.
        /// </summary>
        public void OnPartContact(Collider2D other, float impactSpeed)
        {
            lastContactTime = Time.time;
            if (impactSpeed <= 0f)
            {
                if (Time.time < nextProbeTime) return;
                nextProbeTime = Time.time + 0.15f;
            }
            Consider(other, impactSpeed);
        }

        void Consider(Collider2D col, float impactSpeed)
        {
            if (Attached || Time.time < nextAttachTime) return;
            ProstheticBehaviour other = PartOwner(col);
            if (other != null)
            {
                if (other != this) TryMountOn(other);
                return;
            }
            LimbBehaviour limb = col.GetComponentInParent<LimbBehaviour>();
            if (limb != null) TryAttach(limb, impactSpeed);
        }

        static void SlotNames(ProstheticSlot slot, out string anchorBase, out string replacedBase)
        {
            switch (slot)
            {
                case ProstheticSlot.Forearm: anchorBase = "UpperArm"; replacedBase = "LowerArm"; break;
                case ProstheticSlot.FullArm:
                case ProstheticSlot.UpperArm: anchorBase = "UpperBody"; replacedBase = "UpperArm"; break;
                case ProstheticSlot.LowerLeg: anchorBase = "UpperLeg"; replacedBase = "LowerLeg"; break;
                default: anchorBase = "LowerBody"; replacedBase = "UpperLeg"; break;
            }
        }

        static Dictionary<string, LimbBehaviour> LimbMap(PersonBehaviour person)
        {
            Dictionary<string, LimbBehaviour> map = new Dictionary<string, LimbBehaviour>();
            if (person == null) return map;
            foreach (LimbBehaviour l in person.GetComponentsInChildren<LimbBehaviour>())
            {
                if (l != null && l.gameObject.activeInHierarchy && !map.ContainsKey(l.name)) map[l.name] = l;
            }
            return map;
        }

        static LimbBehaviour Get(Dictionary<string, LimbBehaviour> map, string name)
        {
            LimbBehaviour l;
            return map.TryGetValue(name, out l) ? l : null;
        }

        static bool Connected(Rigidbody2D a, Rigidbody2D b)
        {
            if (a == null || b == null) return false;
            foreach (Joint2D j in a.GetComponents<Joint2D>())
                if (j.enabled && j.connectedBody == b) return true;
            foreach (Joint2D j in b.GetComponents<Joint2D>())
                if (j.enabled && j.connectedBody == a) return true;
            return false;
        }

        /// <summary>Finds the hinge between a limb and its parent. inverted = the joint lives on the parent.</summary>
        static HingeJoint2D FindHinge(Rigidbody2D child, Rigidbody2D parent, out bool inverted)
        {
            inverted = false;
            if (child == null || parent == null) return null;
            foreach (HingeJoint2D j in child.GetComponents<HingeJoint2D>())
                if (j.enabled && j.connectedBody == parent) return j;
            inverted = true;
            foreach (HingeJoint2D j in parent.GetComponents<HingeJoint2D>())
                if (j.enabled && j.connectedBody == child) return j;
            return null;
        }

        bool Occupied(PersonBehaviour person, string replaced)
        {
            foreach (ProstheticBehaviour p in FindObjectsOfType<ProstheticBehaviour>())
            {
                if (p != this && p.Attached && p.Wearer == person && p.ReplacedLimb == replaced) return true;
            }
            return false;
        }

        /// <summary>Modular build: plug a forearm / lower leg into a prosthetic upper arm / thigh.</summary>
        public bool TryMountOn(ProstheticBehaviour mount)
        {
            ProstheticSlot accepts = Slot == ProstheticSlot.Forearm ? ProstheticSlot.UpperArm : ProstheticSlot.UpperLeg;
            if (!mount.IsMount || (Slot != ProstheticSlot.Forearm && Slot != ProstheticSlot.LowerLeg) || mount.Slot != accepts) return false;
            foreach (ProstheticBehaviour p in FindObjectsOfType<ProstheticBehaviour>())
            {
                if (p != this && p.Attached && p.Anchor == mount) return false; // that socket is taken
            }
            MountOnto(mount, true);
            return true;
        }

        void MountOnto(ProstheticBehaviour mount, bool announce)
        {
            string anchorBase, replacedBase;
            SlotNames(Slot, out anchorBase, out replacedBase);
            PersonBehaviour person = mount.Wearer;
            string side = person != null ? mount.Side : null;
            AttachTo(person, LimbMap(person), mount, side != null ? replacedBase + side : null, side, announce);
        }

        public bool TryAttach(LimbBehaviour touched, float impactSpeed)
        {
            PersonBehaviour person = touched.GetComponentInParent<PersonBehaviour>();
            if (person == null) return false;
            Dictionary<string, LimbBehaviour> limbs = LimbMap(person);
            string anchorBase, replacedBase;
            SlotNames(Slot, out anchorBase, out replacedBase);

            List<string> sides = new List<string>();
            string anchorName;
            if (IsTorsoMounted)
            {
                // Touching anywhere on the torso works; fill the front side first.
                string torsoPart = IsArm ? "UpperBody" : "LowerBody";
                if (touched.name != torsoPart && touched.name != "MiddleBody") return Hint(limbs, anchorBase, replacedBase, impactSpeed);
                anchorName = anchorBase;
                sides.Add("Front");
                sides.Add("");
            }
            else
            {
                if (touched.name != anchorBase && touched.name != anchorBase + "Front") return Hint(limbs, anchorBase, replacedBase, impactSpeed);
                anchorName = touched.name;
                sides.Add(touched.name.EndsWith("Front") ? "Front" : "");
            }

            LimbBehaviour anchor = Get(limbs, anchorName);
            if (anchor == null) return false;
            Rigidbody2D anchorRb = anchor.GetComponent<Rigidbody2D>();
            foreach (string side in sides)
            {
                string replaced = replacedBase + side;
                LimbBehaviour existing = Get(limbs, replaced);
                bool missing = existing == null || !Connected(existing.GetComponent<Rigidbody2D>(), anchorRb);
                if (missing && !Occupied(person, replaced))
                {
                    AttachTo(person, limbs, anchor, replaced, side, true);
                    return true;
                }
            }
            return Hint(limbs, anchorBase, replacedBase, impactSpeed);
        }

        /// <summary>
        /// Pushed into the wrong body part of someone this would fit? Say where it goes. Only on a real,
        /// fresh impact (someone moving it), never for a prosthetic that is just lying against a person.
        /// </summary>
        bool Hint(Dictionary<string, LimbBehaviour> limbs, string anchorBase, string replacedBase, float impactSpeed)
        {
            if (impactSpeed < 1f || Time.time < nextHintTime) return false;
            foreach (string side in new string[] { "", "Front" })
            {
                LimbBehaviour anchor = Get(limbs, IsTorsoMounted ? anchorBase : anchorBase + side);
                LimbBehaviour existing = Get(limbs, replacedBase + side);
                if (anchor == null) continue;
                if (existing == null || !Connected(existing.GetComponent<Rigidbody2D>(), anchor.GetComponent<Rigidbody2D>()))
                {
                    nextHintTime = Time.time + 10f;
                    string where;
                    switch (Slot)
                    {
                        case ProstheticSlot.Forearm: where = "upper arm stump (or a prosthetic upper arm)"; break;
                        case ProstheticSlot.LowerLeg: where = "upper leg stump (or a prosthetic thigh)"; break;
                        case ProstheticSlot.FullArm:
                        case ProstheticSlot.UpperArm: where = "chest"; break;
                        default: where = "hips"; break;
                    }
                    ModAPI.Notify(DisplayName + ": touch it to the " + where);
                    return false;
                }
            }
            return false;
        }

        float LimbLength(LimbBehaviour limb)
        {
            if (limb == null) return 0f;
            SpriteRenderer r = limb.GetComponent<SpriteRenderer>();
            if (r != null && r.sprite != null) return r.sprite.bounds.size.y * Mathf.Abs(limb.transform.lossyScale.y);
            Collider2D c = limb.GetComponent<Collider2D>();
            return c != null ? c.bounds.size.y : 0.5f;
        }

        /// <summary>Length of whatever this is mounted on: a stump, or a prosthetic upper arm / thigh (socket to socket).</summary>
        float AnchorLength(Component anchor)
        {
            ProstheticBehaviour mount = anchor as ProstheticBehaviour;
            if (mount != null) return Vector2.Distance(mount.AttachWorld, mount.transform.TransformPoint(mount.MountLocal));
            return LimbLength(anchor as LimbBehaviour);
        }

        float TorsoLength(Dictionary<string, LimbBehaviour> limbs)
        {
            return (LimbLength(Get(limbs, "UpperBody")) + LimbLength(Get(limbs, "MiddleBody")) + LimbLength(Get(limbs, "LowerBody"))) * 0.9f;
        }

        /// <summary>How long the replaced limb should be, measured from the wearer's own body.</summary>
        float ExpectedLength(Dictionary<string, LimbBehaviour> limbs, Component anchor, LimbBehaviour twin, string twinSide)
        {
            switch (Slot)
            {
                case ProstheticSlot.Forearm:
                    return twin != null ? LimbLength(twin) : AnchorLength(anchor) * 1.15f;
                case ProstheticSlot.LowerLeg:
                    return twin != null ? LimbLength(twin) + LimbLength(Get(limbs, "Foot" + twinSide)) * 0.35f : AnchorLength(anchor) * 1.15f;
                case ProstheticSlot.UpperArm:
                    return twin != null ? LimbLength(twin) : TorsoLength(limbs) * 0.65f;
                case ProstheticSlot.UpperLeg:
                    return twin != null ? LimbLength(twin) : TorsoLength(limbs) * 0.8f;
                case ProstheticSlot.FullArm:
                    if (twin == null) return TorsoLength(limbs) * 1.4f;
                    LimbBehaviour lowerArm = Get(limbs, "LowerArm" + twinSide);
                    return (LimbLength(twin) + (lowerArm != null ? LimbLength(lowerArm) : LimbLength(twin) * 1.15f)) * 0.92f;
                default:
                    if (twin == null) return TorsoLength(limbs) * 1.7f;
                    LimbBehaviour lowerLeg = Get(limbs, "LowerLeg" + twinSide);
                    float lower = lowerLeg != null ? LimbLength(lowerLeg) : LimbLength(twin);
                    return (LimbLength(twin) + lower + LimbLength(Get(limbs, "Foot" + twinSide)) * 0.35f) * 0.95f;
            }
        }

        /// <summary>World position of the hinge joining a limb to its parent, if they are still joined.</summary>
        static bool HingePoint(LimbBehaviour child, LimbBehaviour parent, out Vector2 point)
        {
            point = Vector2.zero;
            if (child == null || parent == null) return false;
            bool inverted;
            HingeJoint2D j = FindHinge(child.GetComponent<Rigidbody2D>(), parent.GetComponent<Rigidbody2D>(), out inverted);
            if (j == null) return false;
            point = j.transform.TransformPoint(j.anchor);
            return true;
        }

        /// <summary>How far a body's collision shape reaches past a point along a direction (e.g. from the knee down to the sole).</summary>
        static float Reach(Rigidbody2D body, Vector2 from, Vector2 dir)
        {
            if (body == null) return 0f;
            List<Collider2D> colliders = new List<Collider2D>();
            body.GetAttachedColliders(colliders);
            float best = 0f;
            foreach (Collider2D c in colliders)
            {
                if (c == null || c.isTrigger || !c.enabled) continue;
                Vector2 extreme = c.ClosestPoint(from + dir * 100f);
                best = Mathf.Max(best, Vector2.Dot(extreme - from, dir));
            }
            return best;
        }

        static Rigidbody2D BodyOf(LimbBehaviour limb)
        {
            return limb != null ? limb.GetComponent<Rigidbody2D>() : null;
        }

        static Vector2 DownOf(Component c)
        {
            return -(Vector2)c.transform.up;
        }

        /// <summary>
        /// Length the replaced limb should have, measured on the healthy twin from joint to tip using its real
        /// joints and collision shapes, so it doesn't matter how the twin is bent. 0 when it can't be measured.
        /// </summary>
        float MeasureTwin(Dictionary<string, LimbBehaviour> limbs, string twinSide)
        {
            if (twinSide == null) return 0f;
            if (IsArm)
            {
                LimbBehaviour upper = Get(limbs, "UpperArm" + twinSide);
                LimbBehaviour lower = Get(limbs, "LowerArm" + twinSide);
                Vector2 shoulder, elbow;
                bool hasShoulder = HingePoint(upper, Get(limbs, "UpperBody"), out shoulder);
                bool hasElbow = HingePoint(lower, upper, out elbow);
                if (!hasElbow) return 0f;
                float forearm = Reach(BodyOf(lower), elbow, DownOf(lower));
                if (Slot == ProstheticSlot.Forearm) return forearm;
                if (!hasShoulder) return 0f;
                float upperArm = Vector2.Distance(shoulder, elbow);
                return Slot == ProstheticSlot.UpperArm ? upperArm : upperArm + forearm;
            }
            LimbBehaviour thigh = Get(limbs, "UpperLeg" + twinSide);
            LimbBehaviour shin = Get(limbs, "LowerLeg" + twinSide);
            LimbBehaviour foot = Get(limbs, "Foot" + twinSide);
            Vector2 hip, knee, ankle;
            bool hasHip = HingePoint(thigh, Get(limbs, "LowerBody"), out hip);
            bool hasKnee = HingePoint(shin, thigh, out knee);
            bool hasAnkle = HingePoint(foot, shin, out ankle);
            if (!hasKnee) return 0f;
            // Knee down to the sole: through the foot when there is one, otherwise to the end of the shin.
            float belowKnee = hasAnkle
                ? Vector2.Distance(knee, ankle) + Reach(BodyOf(foot), ankle, DownOf(shin))
                : Reach(BodyOf(shin), knee, DownOf(shin));
            if (Slot == ProstheticSlot.LowerLeg) return belowKnee;
            if (!hasHip) return 0f;
            float thighLength = Vector2.Distance(hip, knee);
            return Slot == ProstheticSlot.UpperLeg ? thighLength : thighLength + belowKnee;
        }

        /// <summary>This prosthetic measured the same way as MeasureTwin, at its current scale.</summary>
        float MeasureSelf(Vector2 attachLocal)
        {
            Physics2D.SyncTransforms();
            Vector2 attach = transform.TransformPoint(attachLocal);
            if (IsMount) return Vector2.Distance(attach, transform.TransformPoint(MountLocal));
            if (segment != null)
            {
                Vector2 joint = transform.TransformPoint(PixelToLocal(jointPixel));
                return Vector2.Distance(attach, joint) + Reach(SegmentBody, joint, -(Vector2)segment.transform.up);
            }
            return Reach(Body, attach, -(Vector2)transform.up);
        }

        /// <summary>Where the missing limb used to hinge, in the anchor's local space, guessed from its sprite.</summary>
        Vector2 EstimateAnchorPoint(Component anchor)
        {
            SpriteRenderer r = anchor.GetComponent<SpriteRenderer>();
            Bounds b = r != null && r.sprite != null ? r.sprite.bounds : new Bounds(Vector3.zero, Vector3.one * 0.5f);
            if (IsTorsoMounted && IsArm) return new Vector2(b.center.x, b.max.y - b.size.y * 0.18f);
            if (IsTorsoMounted) return new Vector2(b.center.x, b.min.y + b.size.y * 0.25f);
            return new Vector2(b.center.x, b.min.y + b.size.y * 0.12f);
        }

        /// <summary>
        /// Fits this prosthetic onto an anchor: a stump (LimbBehaviour) or a modular prosthetic. person / side
        /// may be null for a loose modular assembly that isn't worn by anyone yet.
        /// </summary>
        void AttachTo(PersonBehaviour person, Dictionary<string, LimbBehaviour> limbs, Component anchor, string replaced, string side, bool announce)
        {
            string anchorBase, replacedBase;
            SlotNames(Slot, out anchorBase, out replacedBase);
            ProstheticBehaviour mount = anchor as ProstheticBehaviour;
            Rigidbody2D anchorRb = mount != null ? mount.Body : anchor.GetComponent<Rigidbody2D>();

            // The healthy limb on the other side tells us where the joint goes, its range,
            // the right size, and gives us a pose to mirror.
            string twinSide = side == null ? null : (side == "Front" ? "" : "Front");
            LimbBehaviour twin = twinSide != null ? Get(limbs, replacedBase + twinSide) : null;
            LimbBehaviour twinAnchor = twinSide != null ? Get(limbs, IsTorsoMounted ? anchorBase : anchorBase + twinSide) : null;
            bool twinInverted = false;
            HingeJoint2D twinJoint = null;
            if (twin != null && twinAnchor != null)
                twinJoint = FindHinge(twin.GetComponent<Rigidbody2D>(), twinAnchor.GetComponent<Rigidbody2D>(), out twinInverted);
            if (twinJoint == null) twin = null;

            Vector2 anchorLocal;
            if (mount != null) anchorLocal = mount.MountLocal;
            else if (twinJoint != null) anchorLocal = twinInverted ? twinJoint.anchor : twinJoint.connectedAnchor;
            else anchorLocal = EstimateAnchorPoint(anchor);

            // Resize uniformly so the prosthetic is as long as the limb it replaces.
            // On a modular upper arm / thigh the piece hinges from its socket rim, tucked under the elbow/knee
            // ball, instead of from deep inside the socket (which buried the socket in the upper piece).
            Vector2 attachLocal = PixelToLocal(mount != null ? new Vector2(AttachPixel.x, MountedRimRow) : AttachPixel);
            float ownLength = attachLocal.y - Renderer.sprite.bounds.min.y;
            if (segment != null)
            {
                ownLength = attachLocal.y - PixelToLocal(jointPixel).y
                    + PixelToLocal(SegmentRenderer.sprite, segmentJointPixel).y - SegmentRenderer.sprite.bounds.min.y;
            }
            ownLength = Mathf.Max(0.01f, ownLength);
            // Best: measure the healthy limb joint-to-tip and ourselves the same way, so the sole lands exactly
            // where the healthy foot does. Otherwise fall back to estimating from sprite sizes.
            float scale;
            float expected = MeasureTwin(limbs, twinSide);
            float measured = expected > 0.01f ? MeasureSelf(attachLocal) : 0f;
            if (measured > 0.001f)
            {
                scale = Mathf.Clamp(Mathf.Abs(transform.localScale.y) * expected / measured, 0.02f, 50f);
            }
            else
            {
                expected = ExpectedLength(limbs, anchor, twin, twinSide);
                scale = expected > 0.01f ? Mathf.Clamp(expected / ownLength, 0.02f, 50f) : Mathf.Abs(transform.localScale.y);
            }
            float facing = Mathf.Sign(anchor.transform.lossyScale.x);
            transform.localScale = new Vector3(facing * scale, scale, 1f);

            // Line the socket up with the stump.
            transform.rotation = Quaternion.Euler(0f, 0f, anchorRb.rotation);
            Vector2 target = anchor.transform.TransformPoint(anchorLocal);
            Vector2 offset = target - (Vector2)transform.TransformPoint(attachLocal);
            transform.position += new Vector3(offset.x, offset.y, 0f);
            Physics2D.SyncTransforms();
            Body.velocity = anchorRb.GetPointVelocity(target);
            Body.angularVelocity = anchorRb.angularVelocity;

            Rigidbody2D twinRb = twin != null ? twin.GetComponent<Rigidbody2D>() : null;
            LimbBehaviour twinLower = segment != null && twin != null ? Get(limbs, (IsArm ? "LowerArm" : "LowerLeg") + twinSide) : null;
            Rigidbody2D twinLowerRb = twinLower != null ? twinLower.GetComponent<Rigidbody2D>() : null;
            if (segment != null)
            {
                // Two-piece limb: each half weighs what the real half would (a shin includes the foot).
                Body.mass = twinRb != null ? twinRb.mass : Mathf.Max(0.3f, anchorRb.mass * 0.6f);
                SegmentBody.mass = twinLowerRb != null ? twinLowerRb.mass : Body.mass * 0.8f;
                LimbBehaviour twinFoot = IsArm ? null : Get(limbs, "Foot" + twinSide);
                if (twinFoot != null && twinFoot.GetComponent<Rigidbody2D>() != null) SegmentBody.mass += twinFoot.GetComponent<Rigidbody2D>().mass;
                PlaceSegment();
                // The healthy elbow/knee only lends its range of motion; we don't copy its pose.
                twinMidJoint = twinLowerRb != null ? FindHinge(twinLowerRb, twinRb, out twinMidInverted) : null;
            }
            else
            {
                bool heavy = Slot == ProstheticSlot.FullArm || Slot == ProstheticSlot.FullLeg;
                Body.mass = twinRb != null ? twinRb.mass * (heavy ? 1.8f : 1f) : Mathf.Max(0.3f, anchorRb.mass * (heavy ? 1.2f : 0.8f));
            }

            joint = gameObject.AddComponent<HingeJoint2D>();
            joint.autoConfigureConnectedAnchor = false;
            joint.enableCollision = false;
            joint.connectedBody = anchorRb;
            joint.anchor = attachLocal;
            joint.connectedAnchor = anchorLocal;
            joint.breakForce = Mathf.Infinity;
            joint.breakTorque = Mathf.Infinity;

            JointAngleLimits2D limits = new JointAngleLimits2D();
            if (LockJoint)
            {
                limits.min = -3f;
                limits.max = 3f;
                joint.useLimits = true;
            }
            else if (twinJoint != null && twinJoint.useLimits)
            {
                limits.min = twinInverted ? -twinJoint.limits.max : twinJoint.limits.min;
                limits.max = twinInverted ? -twinJoint.limits.min : twinJoint.limits.max;
                joint.useLimits = true;
            }
            else
            {
                bool hip = IsTorsoMounted && !IsArm;
                limits.min = hip ? -80f : -100f;
                limits.max = hip ? 80f : 100f;
                joint.useLimits = !(IsTorsoMounted && IsArm); // shoulders swing freely
            }
            joint.limits = limits;

            // Arms hold a relaxed pose on their own and never copy the healthy arm (that coupled the two arms
            // together); legs hold straight and strong enough to stand on.
            float wearerMass = 0f;
            if (person != null)
                foreach (Rigidbody2D rb in person.GetComponentsInChildren<Rigidbody2D>()) wearerMass += rb.mass;
            float gravity = Mathf.Max(1f, Physics2D.gravity.magnitude);
            float armMass = Body.mass + (SegmentBody != null ? SegmentBody.mass : 0f);
            // Leg joints carry the wearer; with nobody wearing the assembly yet they only hold themselves.
            float legLoad = person != null ? wearerMass : armMass * 4f;
            motorTorque = IsArm ? armMass * gravity * expected * 1.2f : legLoad * gravity * expected * 1.2f;
            joint.useMotor = !LockJoint;
            socketServo.ResetSample();
            // An elbow only carries the forearm; a knee has to carry the whole wearer.
            if (SegmentBody != null)
                midTorque = IsArm ? SegmentBody.mass * gravity * expected * 0.5f * 1.5f : legLoad * gravity * expected * 0.5f * 1.2f;

            Anchor = anchor;
            directWearer = mount != null ? null : person;
            ReplacedLimb = replaced;
            SyncIgnoredCollisions();

            baseLayerId = Renderer.sortingLayerID;
            baseOrder = Renderer.sortingOrder;
            SpriteRenderer anchorRenderer = mount != null ? mount.Renderer : anchor.GetComponent<SpriteRenderer>();
            if (anchorRenderer != null)
            {
                int order;
                if (mount != null) order = mount.Renderer.sortingOrder - 1; // the elbow/knee ball covers our socket rim
                else if (IsTorsoMounted) order = TorsoSortingOrder(limbs, replaced, side, anchorRenderer);
                else order = anchorRenderer.sortingOrder + 1;
                SetSorting(anchorRenderer.sortingLayerID, order);
            }

            if (announce)
            {
                Play(Res.Attach);
                FX.Burst(Res.Spark, target, new Color(1f, 0.85f, 0.4f), 8, WorldLength * 1.5f, WorldLength * 0.05f, 0.35f, Renderer);
                ModAPI.Notify(DisplayName + " fitted");
            }
            SendMessage("OnProstheticAttached", SendMessageOptions.DontRequireReceiver);
            RefitMountedPieces();
        }

        /// <summary>Draw order for a limb mounted on the torso, so it layers like the limb it replaces.</summary>
        int TorsoSortingOrder(Dictionary<string, LimbBehaviour> limbs, string replaced, string side, SpriteRenderer anchorRenderer)
        {
            // The original limb (cut off but still lying around) knows exactly where it was drawn.
            LimbBehaviour original = replaced != null ? Get(limbs, replaced) : null;
            SpriteRenderer originalRenderer = original != null ? original.GetComponent<SpriteRenderer>() : null;
            if (originalRenderer != null) return originalRenderer.sortingOrder;

            int min = int.MaxValue, max = int.MinValue;
            foreach (LimbBehaviour l in limbs.Values)
            {
                SpriteRenderer r = l != null ? l.GetComponent<SpriteRenderer>() : null;
                if (r == null) continue;
                min = Mathf.Min(min, r.sortingOrder);
                max = Mathf.Max(max, r.sortingOrder);
            }
            bool front = side == "Front";
            if (IsArm)
            {
                // Front arm over everything (legs included), back arm behind everything. The gaps leave room for a
                // forearm drawn one layer above (built-in) or below (plugged into a modular upper arm) without ties.
                if (min == int.MaxValue) return anchorRenderer.sortingOrder + (front ? 3 : -3);
                return front ? max + 2 : min - 3;
            }
            // Legs: mirror the healthy leg around the hips.
            string anchorBase, replacedBase;
            SlotNames(Slot, out anchorBase, out replacedBase);
            LimbBehaviour twin = Get(limbs, replacedBase + (front ? "" : "Front"));
            SpriteRenderer twinRenderer = twin != null ? twin.GetComponent<SpriteRenderer>() : null;
            if (twinRenderer != null) return 2 * anchorRenderer.sortingOrder - twinRenderer.sortingOrder;
            return anchorRenderer.sortingOrder + (front ? 1 : -2);
        }

        /// <summary>Takes the prosthetic off. Safe to call when it isn't attached. Pieces plugged into it stay on it.</summary>
        public void Detach(bool announce)
        {
            if (joint == null) return;
            joint.enabled = false; // Destroy is deferred; stop it acting right now.
            Destroy(joint);
            joint = null;
            RestoreIgnoredCollisions();
            SetSorting(baseLayerId, baseOrder);
            Anchor = null;
            directWearer = null;
            ReplacedLimb = null;
            twinMidJoint = null;
            nextAttachTime = Time.time + 1.5f;
            if (announce) Play(Res.Detach);
            SendMessage("OnProstheticDetached", SendMessageOptions.DontRequireReceiver);
            RefitMountedPieces();
        }

        /// <summary>Re-seats the prosthetic, e.g. after the wearer was flipped around or its mount changed.</summary>
        void Reseat()
        {
            Component anchor = Anchor;
            string replaced = ReplacedLimb;
            Detach(false);
            nextAttachTime = 0f;
            if (anchor == null) return;
            ProstheticBehaviour mount = anchor as ProstheticBehaviour;
            if (mount != null)
            {
                MountOnto(mount, false);
                return;
            }
            PersonBehaviour person = anchor.GetComponentInParent<PersonBehaviour>();
            if (person == null || replaced == null) return;
            string anchorBase, replacedBase;
            SlotNames(Slot, out anchorBase, out replacedBase);
            AttachTo(person, LimbMap(person), anchor, replaced, replaced.Substring(replacedBase.Length), false);
        }

        /// <summary>A modular upper arm / thigh moved, got fitted or came off: refit whatever is plugged into it.</summary>
        void RefitMountedPieces()
        {
            if (!IsMount) return;
            foreach (ProstheticBehaviour p in FindObjectsOfType<ProstheticBehaviour>())
            {
                if (p != this && p.Attached && p.Anchor == this) p.Reseat();
            }
        }

        public IEnumerable<Collider2D> OwnColliders()
        {
            foreach (Collider2D c in GetComponents<Collider2D>()) yield return c;
            if (segment != null)
                foreach (Collider2D c in segment.GetComponents<Collider2D>()) yield return c;
        }

        /// <summary>Stops this prosthetic colliding with its wearer and with the rest of its own assembly.</summary>
        void SyncIgnoredCollisions()
        {
            RestoreIgnoredCollisions();
            if (!Attached) return;
            List<Collider2D> others = new List<Collider2D>();
            PersonBehaviour wearer = Wearer;
            if (wearer != null) others.AddRange(wearer.GetComponentsInChildren<Collider2D>());
            foreach (ProstheticBehaviour p in FindObjectsOfType<ProstheticBehaviour>())
            {
                if (p == this) continue;
                if ((wearer != null && p.Wearer == wearer) || p == AnchorProsthetic || p.AnchorProsthetic == this)
                    others.AddRange(p.OwnColliders());
            }
            foreach (Collider2D mine in OwnColliders())
            {
                foreach (Collider2D theirs in others)
                {
                    if (mine == null || theirs == null) continue;
                    Physics2D.IgnoreCollision(mine, theirs, true);
                    ignoredPairs.Add(new KeyValuePair<Collider2D, Collider2D>(mine, theirs));
                }
            }
        }

        void RestoreIgnoredCollisions()
        {
            foreach (KeyValuePair<Collider2D, Collider2D> pair in ignoredPairs)
            {
                if (pair.Key != null && pair.Value != null) Physics2D.IgnoreCollision(pair.Key, pair.Value, false);
            }
            ignoredPairs.Clear();
        }

        void FixedUpdate()
        {
            // Limb flipped, resized or teleported by the game: re-hang the lower segment to match.
            if (segment != null && (Mathf.Sign(segment.transform.localScale.x) != Mathf.Sign(transform.localScale.x)
                || !Mathf.Approximately(segment.transform.localScale.y, transform.localScale.y) || MidJointPulledApart()))
                PlaceSegment();
            UpdateMidJoint();

            if (joint == null) return;
            // The stump or mount was destroyed or the joint lost its body: fall off instead of pinning to the world.
            if (Anchor == null || joint.connectedBody == null)
            {
                Detach(true);
                return;
            }
            if (Mathf.Sign(Anchor.transform.lossyScale.x) != Mathf.Sign(transform.localScale.x))
            {
                Reseat();
                return;
            }
            socketServo.Sample(joint);
            if (!joint.useMotor) return;

            socketServo.Drive(joint, 0f, motorTorque);
        }

        // ------------------------------------------------------------ two-piece limbs

        /// <summary>
        /// Splits this prosthetic into an upper piece (this object) and a lower segment hinged at the
        /// elbow/knee. Pixel coordinates: joint on this sprite, joint and tip on the segment sprite.
        /// </summary>
        public void BuildSegment(Sprite sprite, Vector2 jointOnUpper, Vector2 jointOnSegment, Vector2 tipOnSegment)
        {
            if (segment != null) Destroy(segment);
            jointPixel = jointOnUpper;
            segmentJointPixel = jointOnSegment;
            TipPixel = tipOnSegment;

            // Built from the game's own Brick prefab so it is a real object you can hover, select, grab and activate.
            segment = SegmentPrefab != null ? Instantiate(SegmentPrefab) : new GameObject();
            segment.name = DisplayName + (IsArm ? " Forearm" : " Shin");
            segment.layer = gameObject.layer;
            SegmentRenderer = segment.GetComponent<SpriteRenderer>();
            if (SegmentRenderer == null) SegmentRenderer = segment.AddComponent<SpriteRenderer>();
            SegmentRenderer.sprite = sprite;
            if (SegmentPrefab == null) SegmentRenderer.sharedMaterial = Renderer.sharedMaterial;
            RegisterOverlay(SegmentRenderer, 1); // drawn over the upper piece so the hinge cap covers the seam

            SegmentBody = segment.GetComponent<Rigidbody2D>();
            if (SegmentBody == null) SegmentBody = segment.AddComponent<Rigidbody2D>();
            SegmentBody.mass = Body.mass * 0.6f;
            SegmentBody.gravityScale = Body.gravityScale;
            SegmentBody.drag = Body.drag;
            SegmentBody.angularDrag = Body.angularDrag;
            SegmentBody.interpolation = Body.interpolation;
            SegmentBody.collisionDetectionMode = Body.collisionDetectionMode;
            PhysicalBehaviour segmentPhysics = segment.GetComponent<PhysicalBehaviour>();
            if (segmentPhysics != null)
            {
                segment.FixColliders();
                PhysicalBehaviour mainPhysics = GetComponent<PhysicalBehaviour>();
                if (mainPhysics != null) segmentPhysics.Properties = mainPhysics.Properties;
                segmentPhysics.ContextMenuOptions.Buttons.Add(new ContextMenuButton("bionicDetach", "Detach prosthetic",
                    "Take this prosthetic off its wearer", new UnityEngine.Events.UnityAction[] { () => Detach(true) }));
            }
            else
            {
                PolygonCollider2D shape = segment.AddComponent<PolygonCollider2D>();
                Collider2D mainShape = GetComponent<Collider2D>();
                if (mainShape != null) shape.sharedMaterial = mainShape.sharedMaterial;
            }
            segment.AddComponent<SegmentLink>().Owner = this;
            PlaceSegment();
        }

        /// <summary>The lower segment's transform, or this one for single-piece prosthetics.</summary>
        public Transform TipTransform { get { return segment != null ? segment.transform : transform; } }

        /// <summary>The renderer of the piece that carries the tip (for tools that animate their sprite).</summary>
        public SpriteRenderer TipRenderer { get { return segment != null ? SegmentRenderer : Renderer; } }

        /// <summary>The tip in TipTransform's local space.</summary>
        public Vector2 TipLocal { get { return PixelToLocal(segment != null ? SegmentRenderer.sprite : Renderer.sprite, TipPixel); } }

        /// <summary>Hangs the lower segment straight down from the joint and (re)creates the hinge.</summary>
        void PlaceSegment()
        {
            if (segment == null) return;
            if (midJoint != null)
            {
                midJoint.enabled = false;
                Destroy(midJoint);
            }
            Transform t = segment.transform;
            t.localScale = transform.localScale;
            t.rotation = transform.rotation;
            Vector2 jointWorld = transform.TransformPoint(PixelToLocal(jointPixel));
            Vector2 segmentLocal = PixelToLocal(SegmentRenderer.sprite, segmentJointPixel);
            t.position = new Vector3(t.position.x, t.position.y, transform.position.z);
            Vector2 offset = jointWorld - (Vector2)t.TransformPoint(segmentLocal);
            t.position += new Vector3(offset.x, offset.y, 0f);
            Physics2D.SyncTransforms();
            SegmentBody.velocity = Body.GetPointVelocity(jointWorld);
            SegmentBody.angularVelocity = Body.angularVelocity;

            midJoint = segment.AddComponent<HingeJoint2D>();
            midJoint.autoConfigureConnectedAnchor = false;
            midJoint.enableCollision = false;
            midJoint.connectedBody = Body;
            midJoint.anchor = segmentLocal;
            midJoint.connectedAnchor = PixelToLocal(jointPixel);
            midJoint.breakForce = Mathf.Infinity;
            midJoint.breakTorque = Mathf.Infinity;
            midJoint.useLimits = true;
            JointAngleLimits2D loose = new JointAngleLimits2D();
            loose.min = -100f;
            loose.max = 100f;
            midJoint.limits = loose;
            midServo.ResetSample();
        }

        bool MidJointPulledApart()
        {
            Vector2 onUpper = transform.TransformPoint(PixelToLocal(jointPixel));
            Vector2 onSegment = segment.transform.TransformPoint(PixelToLocal(SegmentRenderer.sprite, segmentJointPixel));
            float upperLength = Vector2.Distance(AttachWorld, onUpper);
            return Vector2.Distance(onUpper, onSegment) > Mathf.Max(0.05f, upperLength * 0.5f);
        }

        /// <summary>Joint-angle value that swings the lower segment forward (towards the wearer's front) by some degrees.</summary>
        float ForwardBend(float degrees)
        {
            // Forward is counter-clockwise when facing right, clockwise when facing left; the learned
            // convention maps that rotation onto the hinge's own angle sign.
            float convention = midConventionVotes >= 0f ? 1f : -1f;
            return degrees * Mathf.Sign(transform.localScale.x) * convention;
        }

        void UpdateMidJoint()
        {
            if (midJoint == null || SegmentBody == null) return;
            midServo.Sample(midJoint);
            // Learn how the hinge's angle relates to the segment actually turning counter-clockwise.
            float relativeSpin = SegmentBody.angularVelocity - Body.angularVelocity;
            if (Mathf.Abs(relativeSpin) > 20f && Mathf.Abs(midServo.Rate) > 10f)
                midConventionVotes = Mathf.Clamp(midConventionVotes + Mathf.Sign(relativeSpin * midServo.Rate), -10f, 10f);

            bool twinValid = Attached && twinMidJoint != null && twinMidJoint.enabled && twinMidJoint.connectedBody != null;
            // Elbows bend forward, knees bend back: copy the healthy joint's range, or use the natural
            // range once we know which way the hinge measures.
            JointAngleLimits2D limits = midJoint.limits;
            if (twinValid && twinMidJoint.useLimits)
            {
                limits.min = twinMidInverted ? -twinMidJoint.limits.max : twinMidJoint.limits.min;
                limits.max = twinMidInverted ? -twinMidJoint.limits.min : twinMidJoint.limits.max;
            }
            else if (Mathf.Abs(midConventionVotes) >= 3f)
            {
                float a = IsArm ? ForwardBend(-10f) : ForwardBend(5f);
                float b = IsArm ? ForwardBend(145f) : ForwardBend(-140f);
                limits.min = Mathf.Min(a, b);
                limits.max = Mathf.Max(a, b);
            }
            if (!Mathf.Approximately(limits.min, midJoint.limits.min) || !Mathf.Approximately(limits.max, midJoint.limits.max))
                midJoint.limits = limits;

            // Loose on the floor the segment flops freely. Worn, an elbow rests slightly bent (gently, so dragging
            // it doesn't fight you); a knee locks straight to stand on, but gives under hard impacts and springs back.
            if (!Attached)
            {
                midJoint.useMotor = false;
                return;
            }
            float target = IsArm ? ForwardBend(15f) : 0f;
            midServo.Drive(midJoint, target, midTorque);
        }

        void OnDestroy()
        {
            if (segment != null) Destroy(segment);
            RestoreIgnoredCollisions();
        }
    }

    /// <summary>
    /// Drives a hinge's motor towards a target angle. It learns from the joint's own response which
    /// way the motor turns it, so it never depends on Unity's sign conventions.
    /// </summary>
    class Servo
    {
        public float Rate;
        float votes;
        float lastAngle;
        bool hasLast;

        public void ResetSample()
        {
            hasLast = false;
            Rate = 0f;
        }

        public void Sample(HingeJoint2D j)
        {
            float a = j.jointAngle;
            Rate = hasLast ? (a - lastAngle) / Time.fixedDeltaTime : 0f;
            lastAngle = a;
            hasLast = true;
        }

        public void Drive(HingeJoint2D j, float target, float torque)
        {
            if (j.useLimits) target = Mathf.Clamp(target, j.limits.min, j.limits.max);
            JointMotor2D motor = j.motor;
            // Only learn while the motor is clearly in charge (the joint turns at about the commanded speed).
            // Someone dragging the limb moves it at speeds the motor never asked for, so that can't
            // flip the answer, and once we're sure it stays locked.
            float commanded = Mathf.Abs(motor.motorSpeed);
            bool motorInControl = commanded > 30f && Mathf.Abs(Mathf.Abs(Rate) - commanded) < commanded * 0.35f;
            if (j.useMotor && motorInControl && Mathf.Abs(votes) < 8f)
                votes = Mathf.Clamp(votes + Mathf.Sign(motor.motorSpeed * Rate), -8f, 8f);
            float sign = votes >= 0f ? 1f : -1f;
            motor.motorSpeed = sign * Mathf.Clamp((target - j.jointAngle) * 12f, -720f, 720f);
            motor.maxMotorTorque = torque;
            j.motor = motor;
            j.useMotor = true;
        }
    }

    /// <summary>Lives on a two-piece limb's lower segment: reports its contacts and dies with its upper piece.</summary>
    public class SegmentLink : MonoBehaviour
    {
        public ProstheticBehaviour Owner;

        void OnCollisionEnter2D(Collision2D collision)
        {
            if (Owner != null) Owner.OnPartContact(collision.collider, collision.relativeVelocity.magnitude);
        }

        void OnCollisionStay2D(Collision2D collision)
        {
            if (Owner != null) Owner.OnPartContact(collision.collider, 0f);
        }

        // Activating the forearm / shin itself (F) triggers the prosthetic's ability.
        public void Use(ActivationPropagation activation)
        {
            if (Owner != null) Owner.SendMessage("Use", activation, SendMessageOptions.DontRequireReceiver);
        }

        void Update()
        {
            if (Owner == null) Destroy(gameObject);
        }
    }
}
