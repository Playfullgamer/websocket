using System.Collections.Generic;
using UnityEngine;

namespace BionicProsthetics
{
    /// <summary>Which missing body part a prosthetic replaces.</summary>
    public enum ProstheticSlot
    {
        Forearm,  // replaces LowerArm, mounts on the UpperArm stump
        FullArm,  // replaces the whole arm, mounts on the UpperBody (shoulder)
        LowerLeg, // replaces LowerLeg + Foot, mounts on the UpperLeg stump
        FullLeg   // replaces the whole leg, mounts on the LowerBody (hip)
    }

    /// <summary>
    /// Core prosthetic logic. Touch a prosthetic to a stump and it snaps on with a powered
    /// hinge joint, sized to match the wearer and posed to mirror their healthy limb.
    /// </summary>
    public class ProstheticBehaviour : MonoBehaviour
    {
        public ProstheticSlot Slot;
        public string DisplayName = "Prosthetic";
        /// <summary>Socket joint point, in texture pixels from the top-left.</summary>
        public Vector2 AttachPixel;
        /// <summary>Business end (hand, sole, muzzle...), in texture pixels from the top-left.</summary>
        public Vector2 TipPixel;
        /// <summary>Locks the joint nearly rigid, like a real peg leg or running blade.</summary>
        public bool LockJoint;

        public bool Attached { get { return joint != null; } }
        public LimbBehaviour Anchor { get; private set; }
        public PersonBehaviour Wearer { get; private set; }
        public string ReplacedLimb { get; private set; }
        public Rigidbody2D Body { get; private set; }
        public SpriteRenderer Renderer { get; private set; }

        HingeJoint2D joint;
        HingeJoint2D mimicJoint;
        bool mimicInverted;
        float motorTorque;
        float motorSignVotes;
        float nextAttachTime;
        float nextProbeTime;
        float lastContactTime = -10f;
        float nextHintTime;
        AudioSource audioSource;
        int baseLayerId;
        int baseOrder;
        readonly List<KeyValuePair<Collider2D, Collider2D>> ignoredPairs = new List<KeyValuePair<Collider2D, Collider2D>>();
        readonly List<KeyValuePair<SpriteRenderer, int>> overlays = new List<KeyValuePair<SpriteRenderer, int>>();

        bool IsArm { get { return Slot == ProstheticSlot.Forearm || Slot == ProstheticSlot.FullArm; } }
        bool IsFull { get { return Slot == ProstheticSlot.FullArm || Slot == ProstheticSlot.FullLeg; } }

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
            Sprite s = Renderer.sprite;
            float ppu = s.pixelsPerUnit;
            return new Vector2((px.x + 0.5f - s.pivot.x) / ppu, (s.rect.height - px.y - 0.5f - s.pivot.y) / ppu);
        }

        public Vector2 AttachWorld { get { return transform.TransformPoint(PixelToLocal(AttachPixel)); } }
        public Vector2 TipWorld { get { return transform.TransformPoint(PixelToLocal(TipPixel)); } }
        /// <summary>World direction pointing from the socket towards the extremity.</summary>
        public Vector2 AxisDown { get { return -(Vector2)transform.up; } }
        /// <summary>World length from socket to tip; a handy size reference for effects.</summary>
        public float WorldLength { get { return Mathf.Max(0.05f, Vector2.Distance(AttachWorld, TipWorld)); } }
        public int CollisionMask { get { return Physics2D.GetLayerCollisionMask(gameObject.layer); } }

        // ------------------------------------------------------------ wearer helpers

        /// <summary>True for this prosthetic, the wearer's own limbs and their other prosthetics.</summary>
        public bool IsOwnBody(Collider2D col)
        {
            if (col == null) return false;
            if (col.attachedRigidbody == Body || col.transform.IsChildOf(transform)) return true;
            if (Wearer == null) return false;
            if (col.transform.IsChildOf(Wearer.transform)) return true;
            ProstheticBehaviour other = col.GetComponentInParent<ProstheticBehaviour>();
            return other != null && other.Wearer == Wearer;
        }

        /// <summary>Everything that should move together when the prosthetic launches its wearer.</summary>
        public List<Rigidbody2D> WearerBodies()
        {
            List<Rigidbody2D> list = new List<Rigidbody2D>();
            list.Add(Body);
            if (Wearer == null) return list;
            list.AddRange(Wearer.GetComponentsInChildren<Rigidbody2D>());
            foreach (ProstheticBehaviour p in FindObjectsOfType<ProstheticBehaviour>())
            {
                if (p != this && p.Wearer == Wearer && p.Body != null) list.Add(p.Body);
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
            lastContactTime = Time.time;
            Consider(collision.collider);
        }

        void OnCollisionStay2D(Collision2D collision)
        {
            lastContactTime = Time.time;
            if (Time.time < nextProbeTime) return;
            nextProbeTime = Time.time + 0.15f;
            Consider(collision.collider);
        }

        void Consider(Collider2D col)
        {
            if (Attached || Time.time < nextAttachTime) return;
            LimbBehaviour limb = col.GetComponentInParent<LimbBehaviour>();
            if (limb != null) TryAttach(limb);
        }

        static void SlotNames(ProstheticSlot slot, out string anchorBase, out string replacedBase)
        {
            switch (slot)
            {
                case ProstheticSlot.Forearm: anchorBase = "UpperArm"; replacedBase = "LowerArm"; break;
                case ProstheticSlot.FullArm: anchorBase = "UpperBody"; replacedBase = "UpperArm"; break;
                case ProstheticSlot.LowerLeg: anchorBase = "UpperLeg"; replacedBase = "LowerLeg"; break;
                default: anchorBase = "LowerBody"; replacedBase = "UpperLeg"; break;
            }
        }

        static Dictionary<string, LimbBehaviour> LimbMap(PersonBehaviour person)
        {
            Dictionary<string, LimbBehaviour> map = new Dictionary<string, LimbBehaviour>();
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

        public bool TryAttach(LimbBehaviour touched)
        {
            PersonBehaviour person = touched.GetComponentInParent<PersonBehaviour>();
            if (person == null) return false;
            Dictionary<string, LimbBehaviour> limbs = LimbMap(person);
            string anchorBase, replacedBase;
            SlotNames(Slot, out anchorBase, out replacedBase);

            List<string> sides = new List<string>();
            string anchorName;
            if (IsFull)
            {
                // Touching anywhere on the torso works; fill the front side first.
                string torsoPart = Slot == ProstheticSlot.FullArm ? "UpperBody" : "LowerBody";
                if (touched.name != torsoPart && touched.name != "MiddleBody") return Hint(limbs, anchorBase, replacedBase);
                anchorName = anchorBase;
                sides.Add("Front");
                sides.Add("");
            }
            else
            {
                if (touched.name != anchorBase && touched.name != anchorBase + "Front") return Hint(limbs, anchorBase, replacedBase);
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
            return Hint(limbs, anchorBase, replacedBase);
        }

        /// <summary>Touched the wrong body part of someone this would fit? Say where it goes.</summary>
        bool Hint(Dictionary<string, LimbBehaviour> limbs, string anchorBase, string replacedBase)
        {
            if (Time.time < nextHintTime) return false;
            foreach (string side in new string[] { "", "Front" })
            {
                LimbBehaviour anchor = Get(limbs, IsFull ? anchorBase : anchorBase + side);
                LimbBehaviour existing = Get(limbs, replacedBase + side);
                if (anchor == null) continue;
                if (existing == null || !Connected(existing.GetComponent<Rigidbody2D>(), anchor.GetComponent<Rigidbody2D>()))
                {
                    nextHintTime = Time.time + 4f;
                    string where;
                    switch (Slot)
                    {
                        case ProstheticSlot.Forearm: where = "upper arm"; break;
                        case ProstheticSlot.FullArm: where = "chest"; break;
                        case ProstheticSlot.LowerLeg: where = "upper leg"; break;
                        default: where = "hips"; break;
                    }
                    ModAPI.Notify(DisplayName + ": touch it to the " + where + " stump");
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

        float TorsoLength(Dictionary<string, LimbBehaviour> limbs)
        {
            return (LimbLength(Get(limbs, "UpperBody")) + LimbLength(Get(limbs, "MiddleBody")) + LimbLength(Get(limbs, "LowerBody"))) * 0.9f;
        }

        /// <summary>How long the replaced limb should be, measured from the wearer's own body.</summary>
        float ExpectedLength(Dictionary<string, LimbBehaviour> limbs, LimbBehaviour anchor, LimbBehaviour twin, string twinSide)
        {
            switch (Slot)
            {
                case ProstheticSlot.Forearm:
                    return twin != null ? LimbLength(twin) : LimbLength(anchor) * 1.15f;
                case ProstheticSlot.LowerLeg:
                    return twin != null ? LimbLength(twin) + LimbLength(Get(limbs, "Foot" + twinSide)) * 0.35f : LimbLength(anchor) * 1.15f;
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

        /// <summary>Where the missing limb used to hinge, in the anchor's local space, guessed from its sprite.</summary>
        Vector2 EstimateAnchorPoint(LimbBehaviour anchor)
        {
            SpriteRenderer r = anchor.GetComponent<SpriteRenderer>();
            Bounds b = r != null && r.sprite != null ? r.sprite.bounds : new Bounds(Vector3.zero, Vector3.one * 0.5f);
            switch (Slot)
            {
                case ProstheticSlot.FullArm: return new Vector2(b.center.x, b.max.y - b.size.y * 0.18f);
                case ProstheticSlot.FullLeg: return new Vector2(b.center.x, b.min.y + b.size.y * 0.25f);
                default: return new Vector2(b.center.x, b.min.y + b.size.y * 0.12f);
            }
        }

        void AttachTo(PersonBehaviour person, Dictionary<string, LimbBehaviour> limbs, LimbBehaviour anchor, string replaced, string side, bool announce)
        {
            string anchorBase, replacedBase;
            SlotNames(Slot, out anchorBase, out replacedBase);
            Rigidbody2D anchorRb = anchor.GetComponent<Rigidbody2D>();

            // The healthy limb on the other side tells us where the joint goes, its range,
            // the right size, and gives us a pose to mirror.
            string twinSide = side == "Front" ? "" : "Front";
            LimbBehaviour twin = Get(limbs, replacedBase + twinSide);
            LimbBehaviour twinAnchor = Get(limbs, IsFull ? anchorBase : anchorBase + twinSide);
            bool twinInverted = false;
            HingeJoint2D twinJoint = null;
            if (twin != null && twinAnchor != null)
                twinJoint = FindHinge(twin.GetComponent<Rigidbody2D>(), twinAnchor.GetComponent<Rigidbody2D>(), out twinInverted);
            if (twinJoint == null) twin = null;

            Vector2 anchorLocal = twinJoint != null
                ? (twinInverted ? twinJoint.anchor : twinJoint.connectedAnchor)
                : EstimateAnchorPoint(anchor);

            // Resize uniformly so the prosthetic is as long as the limb it replaces.
            Vector2 attachLocal = PixelToLocal(AttachPixel);
            float ownLength = Mathf.Max(0.01f, attachLocal.y - Renderer.sprite.bounds.min.y);
            float expected = ExpectedLength(limbs, anchor, twin, twinSide);
            float scale = expected > 0.01f ? Mathf.Clamp(expected / ownLength, 0.02f, 50f) : Mathf.Abs(transform.localScale.y);
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
            Body.mass = twinRb != null ? twinRb.mass * (IsFull ? 1.8f : 1f) : Mathf.Max(0.3f, anchorRb.mass * (IsFull ? 1.2f : 0.8f));

            // Don't fight the wearer's own body.
            foreach (Collider2D mine in GetComponents<Collider2D>())
            {
                foreach (Collider2D theirs in person.GetComponentsInChildren<Collider2D>())
                {
                    Physics2D.IgnoreCollision(mine, theirs, true);
                    ignoredPairs.Add(new KeyValuePair<Collider2D, Collider2D>(mine, theirs));
                }
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
                limits.min = Slot == ProstheticSlot.FullLeg ? -80f : -100f;
                limits.max = Slot == ProstheticSlot.FullLeg ? 80f : 100f;
                joint.useLimits = Slot != ProstheticSlot.FullArm;
            }
            joint.limits = limits;

            // Arms mirror the healthy arm; legs hold straight and strong enough to stand on.
            mimicJoint = IsArm ? twinJoint : null;
            mimicInverted = twinInverted;
            float wearerMass = 0f;
            foreach (Rigidbody2D rb in person.GetComponentsInChildren<Rigidbody2D>()) wearerMass += rb.mass;
            float gravity = Mathf.Max(1f, Physics2D.gravity.magnitude);
            motorTorque = IsArm ? Body.mass * gravity * expected * 6f : wearerMass * gravity * expected * 1.2f;
            joint.useMotor = !LockJoint;

            Anchor = anchor;
            Wearer = person;
            ReplacedLimb = replaced;

            baseLayerId = Renderer.sortingLayerID;
            baseOrder = Renderer.sortingOrder;
            SpriteRenderer anchorRenderer = anchor.GetComponent<SpriteRenderer>();
            if (anchorRenderer != null)
            {
                int offsetOrder = IsFull ? (side == "Front" ? 2 : -2) : 1;
                SetSorting(anchorRenderer.sortingLayerID, anchorRenderer.sortingOrder + offsetOrder);
            }

            if (announce)
            {
                Play(Res.Attach);
                FX.Burst(Res.Spark, target, new Color(1f, 0.85f, 0.4f), 8, WorldLength * 1.5f, WorldLength * 0.05f, 0.35f, Renderer);
                ModAPI.Notify(DisplayName + " fitted");
            }
            SendMessage("OnProstheticAttached", SendMessageOptions.DontRequireReceiver);
        }

        /// <summary>Takes the prosthetic off. Safe to call when it isn't attached.</summary>
        public void Detach(bool announce)
        {
            if (joint == null) return;
            Destroy(joint);
            joint = null;
            foreach (KeyValuePair<Collider2D, Collider2D> pair in ignoredPairs)
            {
                if (pair.Key != null && pair.Value != null) Physics2D.IgnoreCollision(pair.Key, pair.Value, false);
            }
            ignoredPairs.Clear();
            SetSorting(baseLayerId, baseOrder);
            Anchor = null;
            Wearer = null;
            ReplacedLimb = null;
            mimicJoint = null;
            nextAttachTime = Time.time + 1.5f;
            if (announce) Play(Res.Detach);
            SendMessage("OnProstheticDetached", SendMessageOptions.DontRequireReceiver);
        }

        /// <summary>Re-seats the prosthetic, e.g. after the wearer was flipped around.</summary>
        void Reseat()
        {
            LimbBehaviour anchor = Anchor;
            PersonBehaviour person = Wearer;
            string replaced = ReplacedLimb;
            Detach(false);
            nextAttachTime = 0f;
            if (anchor == null || person == null) return;
            string anchorBase, replacedBase;
            SlotNames(Slot, out anchorBase, out replacedBase);
            string side = replaced.Substring(replacedBase.Length);
            AttachTo(person, LimbMap(person), anchor, replaced, side, false);
        }

        void FixedUpdate()
        {
            if (joint == null) return;
            // The stump itself was destroyed or the joint lost its body: fall off instead of pinning to the world.
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
            if (!joint.useMotor) return;

            float target = 0f;
            if (mimicJoint != null && mimicJoint.enabled && mimicJoint.connectedBody != null)
                target = mimicInverted ? -mimicJoint.jointAngle : mimicJoint.jointAngle;
            if (joint.useLimits) target = Mathf.Clamp(target, joint.limits.min, joint.limits.max);
            JointMotor2D motor = joint.motor;
            // Learn whether motor speed and joint angle share a sign convention by watching the
            // joint respond, so the servo never pushes the wrong way.
            if (Mathf.Abs(motor.motorSpeed) > 30f && Mathf.Abs(joint.jointSpeed) > 15f)
                motorSignVotes = Mathf.Clamp(motorSignVotes + Mathf.Sign(motor.motorSpeed * joint.jointSpeed), -10f, 10f);
            float motorSign = motorSignVotes >= 0f ? 1f : -1f;
            motor.motorSpeed = motorSign * Mathf.Clamp((target - joint.jointAngle) * 12f, -720f, 720f);
            motor.maxMotorTorque = motorTorque;
            joint.motor = motor;
        }

        void OnDestroy()
        {
            foreach (KeyValuePair<Collider2D, Collider2D> pair in ignoredPairs)
            {
                if (pair.Key != null && pair.Value != null) Physics2D.IgnoreCollision(pair.Key, pair.Value, false);
            }
        }
    }
}
