using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace BionicProsthetics
{
    /// <summary>Base for anything that happens when a prosthetic is activated (F / "Use").</summary>
    public abstract class ProstheticAbility : MonoBehaviour
    {
        protected ProstheticBehaviour P;

        protected virtual void Awake()
        {
            P = GetComponent<ProstheticBehaviour>();
        }

        // Called by People Playground when the object is activated.
        public void Use(ActivationPropagation activation)
        {
            if (enabled) Activate();
        }

        protected abstract void Activate();

        /// <summary>Something hit part of the prosthetic (part = the main body or the lower segment).</summary>
        public virtual void OnImpact(Collision2D collision, Rigidbody2D part)
        {
        }

        protected static bool IsPerson(Rigidbody2D body)
        {
            return body != null && body.GetComponent<LimbBehaviour>() != null;
        }

        protected Collider2D FindTarget(Vector2 point, float radius)
        {
            Collider2D best = null;
            float bestDist = float.MaxValue;
            foreach (Collider2D c in Physics2D.OverlapCircleAll(point, radius, P.CollisionMask))
            {
                if (c.isTrigger || P.IsOwnBody(c)) continue;
                float d = Vector2.Distance(c.ClosestPoint(point), point);
                if (d < bestDist)
                {
                    bestDist = d;
                    best = c;
                }
            }
            return best;
        }
    }

    /// <summary>Running blade, pogo spring and cyber leg: launch the wearer into the air.</summary>
    public class SpringJump : ProstheticAbility
    {
        public float Power = 9f;
        public AudioClip Sound;
        public Sprite SquashSprite;
        public bool Shockwave;
        public Color DustColor = new Color(0.85f, 0.8f, 0.7f, 0.8f);

        float readyTime;

        protected override void Activate()
        {
            if (Time.time < readyTime || !P.Grounded) return;
            readyTime = Time.time + 0.45f;
            if (SquashSprite != null)
                StartCoroutine(Squash());
            else
                Launch();
        }

        IEnumerator Squash()
        {
            Sprite normal = P.Renderer.sprite;
            P.Renderer.sprite = SquashSprite;
            yield return new WaitForSeconds(0.08f);
            P.Renderer.sprite = normal;
            Launch();
        }

        void Launch()
        {
            Vector2 dir = ((Vector2)transform.up + Vector2.up * 1.5f).normalized;
            foreach (Rigidbody2D rb in P.WearerBodies()) rb.velocity += dir * Power;
            P.Play(Sound);
            float L = P.WorldLength;
            Vector2 foot = P.TipWorld;
            FX.Spray(Res.Puff, foot, Vector2.left, 25f, DustColor, 4, L * 2f, L * 0.18f, L * 0.4f, 0.5f, 0f, P.Renderer);
            FX.Spray(Res.Puff, foot, Vector2.right, 25f, DustColor, 4, L * 2f, L * 0.18f, L * 0.4f, 0.5f, 0f, P.Renderer);
            if (Shockwave)
            {
                Color cyan = new Color(0.35f, 0.92f, 1f, 1f);
                FX.Shockwave(foot, cyan, L * 1.2f, P.Renderer);
                FX.Burst(Res.Spark, foot, cyan, 14, L * 4f, L * 0.06f, 0.4f, P.Renderer);
                FX.Blast(foot, L * 1.3f, 7f, P, false);
            }
        }
    }

    /// <summary>
    /// Hooks and claws. Activate to latch onto whatever the tip touches - people, loose objects, even walls -
    /// and again to let go. Impalers (hooks) also sink into anything they're swung into hard enough.
    /// </summary>
    public class Grabber : ProstheticAbility
    {
        public Sprite ClosedSprite;
        /// <summary>Hooks: a hard swing into something sticks the point in; activate (or a hard yank) frees it.</summary>
        public bool Impales;
        /// <summary>Magnet boots: clamp to the floor/walls first, loose things only when no surface is in reach.</summary>
        public bool PreferSurfaces;

        Sprite openSprite;
        Joint2D grip;
        bool holding;
        bool holdingBody; // false when latched onto the world itself (a wall or the floor)
        bool impaled;
        Rigidbody2D held;
        float readyTime;

        void Start()
        {
            openSprite = P.TipRenderer.sprite;
        }

        protected override void Activate()
        {
            if (holding)
            {
                Release(true);
                return;
            }
            Collider2D target = FindGrabTarget();
            if (target == null)
            {
                // Snap shut on thin air for feedback.
                if (ClosedSprite != null) StartCoroutine(Snap());
                P.Play(Res.Release, 0.6f);
                return;
            }
            FixedJoint2D clamp = P.TipTransform.gameObject.AddComponent<FixedJoint2D>();
            clamp.autoConfigureConnectedAnchor = true;
            clamp.enableCollision = false;
            clamp.anchor = P.TipLocal;
            clamp.connectedBody = target.attachedRigidbody; // null = hold on to the world itself
            Hold(clamp, target.attachedRigidbody, false);
            if (ClosedSprite != null) P.TipRenderer.sprite = ClosedSprite;
            P.Play(Res.Grab);
            float L = P.WorldLength;
            if (IsPerson(held))
            {
                // Clamping down on someone: a hard squeeze they feel.
                held.angularVelocity += UnityEngine.Random.Range(-300f, 300f);
                FX.Blood(P.TipWorld, P.AxisDown, 5, L, P.Renderer);
            }
            FX.Burst(Res.Spark, P.TipWorld, new Color(1f, 0.9f, 0.6f), 6, L * 2f, L * 0.05f, 0.25f, P.Renderer);
        }

        /// <summary>People and loose objects first; the floor or a wall only when nothing else is in reach.</summary>
        Collider2D FindGrabTarget()
        {
            Vector2 tip = P.TipWorld;
            float radius = P.WorldLength * 0.22f;
            Collider2D best = null;
            float bestScore = float.MaxValue;
            foreach (Collider2D c in Physics2D.OverlapCircleAll(tip, radius, P.CollisionMask))
            {
                if (c.isTrigger || P.IsOwnBody(c)) continue;
                bool loose = c.attachedRigidbody != null && c.attachedRigidbody.bodyType == RigidbodyType2D.Dynamic;
                float score = Vector2.Distance(c.ClosestPoint(tip), tip) + (loose != PreferSurfaces ? 0f : radius);
                if (score < bestScore)
                {
                    bestScore = score;
                    best = c;
                }
            }
            return best;
        }

        public override void OnImpact(Collision2D collision, Rigidbody2D part)
        {
            if (!Impales || holding || part != P.TipBody || Time.time < readyTime) return;
            Rigidbody2D target = collision.rigidbody;
            if (target == null || target.bodyType != RigidbodyType2D.Dynamic || P.IsOwnBody(collision.collider)) return;
            float L = P.WorldLength;
            if (collision.relativeVelocity.magnitude < L * 5f) return; // it takes a real swing
            Vector2 point = collision.contactCount > 0 ? collision.GetContact(0).point : P.TipWorld;
            if (Vector2.Distance(point, P.TipWorld) > L * 0.3f) return; // only the point impales

            // A hinge, so whatever is skewered hangs and swings off the hook.
            HingeJoint2D skewer = P.TipTransform.gameObject.AddComponent<HingeJoint2D>();
            skewer.autoConfigureConnectedAnchor = true;
            skewer.enableCollision = false;
            skewer.anchor = P.TipTransform.InverseTransformPoint(point);
            skewer.connectedBody = target;
            float gravity = Mathf.Max(1f, Physics2D.gravity.magnitude);
            skewer.breakForce = Mathf.Max(150f, (target.mass + P.TipBody.mass) * gravity * 25f); // a hard yank tears it out
            Hold(skewer, target, true);
            P.Play(Res.Impale);
            Vector2 spray = collision.relativeVelocity.sqrMagnitude > 0.01f ? collision.relativeVelocity.normalized : -P.AxisDown;
            if (IsPerson(target)) FX.Blood(point, spray, 16, L, P.Renderer);
            else FX.Burst(Res.Spark, point, new Color(0.8f, 0.7f, 0.5f), 8, L * 2f, L * 0.05f, 0.3f, P.Renderer);
        }

        void Hold(Joint2D joint, Rigidbody2D body, bool skewered)
        {
            grip = joint;
            held = body;
            impaled = skewered;
            holdingBody = body != null;
            holding = true;
        }

        IEnumerator Snap()
        {
            P.TipRenderer.sprite = ClosedSprite;
            yield return new WaitForSeconds(0.2f);
            if (!holding) P.TipRenderer.sprite = openSprite;
        }

        void Release(bool sound)
        {
            if (grip != null)
            {
                grip.enabled = false;
                Destroy(grip);
            }
            if (impaled && IsPerson(held)) FX.Blood(P.TipWorld, -P.AxisDown, 8, P.WorldLength, P.Renderer);
            grip = null;
            held = null;
            impaled = false;
            holding = false;
            readyTime = Time.time + 0.5f; // don't instantly re-skewer what we just pulled out of
            if (ClosedSprite != null) P.TipRenderer.sprite = openSprite;
            if (sound) P.Play(Res.Release);
        }

        void FixedUpdate()
        {
            if (!holding) return;
            // Joint gone: torn out by a hard yank (or deleted).
            if (grip == null)
            {
                Release(true);
                return;
            }
            // The thing we held was deleted: let go rather than pin ourselves to the world.
            if (holdingBody && held == null) Release(false);
        }
    }

    /// <summary>Plasma arm cannon: fires glowing bolts that blow things away.</summary>
    public class PlasmaCannon : ProstheticAbility
    {
        float readyTime;

        protected override void Activate()
        {
            if (Time.time < readyTime) return;
            readyTime = Time.time + 0.22f;
            Vector2 dir = P.AxisDown;
            float L = P.WorldLength;
            Vector2 muzzle = P.TipWorld + dir * L * 0.05f;
            PlasmaBolt.Spawn(muzzle, dir * 30f, P);
            P.TipBody.velocity -= dir * 2.5f;
            P.Play(Res.PlasmaFire, 0.9f);
            Color green = new Color(0.45f, 1f, 0.65f, 1f);
            FX.Particle(Res.Glow, muzzle, Vector2.zero, green, L * 0.5f, L * 0.1f, 0.12f, 0f, 0f, P.Renderer);
            FX.Spray(Res.Spark, muzzle, dir, 30f, green, 6, L * 5f, L * 0.05f, 0f, 0.2f, 0f, P.Renderer);
        }
    }

    public class PlasmaBolt : MonoBehaviour
    {
        Vector2 velocity;
        ProstheticBehaviour source;
        SpriteRenderer sortRef;
        AudioSource audioTemplate;
        float life = 2.5f;
        float size;
        float trailTimer;
        int mask;

        public static void Spawn(Vector2 pos, Vector2 velocity, ProstheticBehaviour source)
        {
            GameObject go = new GameObject("Plasma Bolt");
            go.transform.position = pos;
            SpriteRenderer r = go.AddComponent<SpriteRenderer>();
            r.sprite = Res.Plasma;
            r.sortingLayerID = source.Renderer.sortingLayerID;
            r.sortingOrder = source.Renderer.sortingOrder + 10;
            float size = source.WorldLength * 0.3f;
            go.transform.localScale = Vector3.one * size / Mathf.Max(0.001f, Res.Plasma.bounds.size.x);
            PlasmaBolt b = go.AddComponent<PlasmaBolt>();
            b.velocity = velocity;
            b.source = source;
            b.sortRef = r;
            b.size = size;
            b.mask = source.CollisionMask;
            b.audioTemplate = source.AudioTemplate;
            ModAPI.CreateLight(go.transform, new Color(0.4f, 1f, 0.6f), size * 6f, 1.2f);
        }

        void Update()
        {
            float dt = Time.deltaTime;
            if (dt <= 0f) return;
            life -= dt;
            if (life <= 0f)
            {
                Destroy(gameObject);
                return;
            }

            Vector2 pos = transform.position;
            Vector2 step = velocity * dt;
            RaycastHit2D[] hits = Physics2D.RaycastAll(pos, step.normalized, step.magnitude, mask);
            Array.Sort(hits, (a, b) => a.distance.CompareTo(b.distance));
            foreach (RaycastHit2D hit in hits)
            {
                if (hit.collider == null || hit.collider.isTrigger) continue;
                if (source != null && source.IsOwnBody(hit.collider)) continue;
                Impact(hit);
                return;
            }
            transform.position = pos + step;
            transform.Rotate(0f, 0f, 900f * dt);

            trailTimer -= dt;
            if (trailTimer <= 0f)
            {
                trailTimer = 0.012f;
                FX.Particle(Res.Glow, pos, -velocity * 0.03f, new Color(0.4f, 1f, 0.6f, 0.7f), size * 1.1f, 0f, 0.18f, 0f, 0f, sortRef);
            }
        }

        void Impact(RaycastHit2D hit)
        {
            Color green = new Color(0.45f, 1f, 0.65f, 1f);
            FX.Shockwave(hit.point, green, size * 3f, sortRef);
            FX.Burst(Res.Spark, hit.point, green, 16, size * 18f, size * 0.25f, 0.45f, sortRef);
            FX.Burst(Res.Puff, hit.point, new Color(0.3f, 0.35f, 0.3f, 0.6f), 5, size * 5f, size * 1.2f, 0.6f, sortRef);
            FX.PlayAt(Res.PlasmaHit, hit.point, 0.9f, audioTemplate);
            FX.Blast(hit.point, size * 4f, 9f, source, false);
            Rigidbody2D rb = hit.collider.attachedRigidbody;
            if (rb != null)
            {
                rb.AddForceAtPosition(velocity.normalized * 4f * Mathf.Min(rb.mass, 6f), hit.point, ForceMode2D.Impulse);
                if (UnityEngine.Random.value < 0.35f) rb.SendMessage("BreakBone", SendMessageOptions.DontRequireReceiver);
            }
            Destroy(gameObject);
        }
    }

    /// <summary>Cyber arm: a rocket-assisted haymaker with a shockwave at the fist.</summary>
    public class PowerPunch : ProstheticAbility
    {
        float readyTime;

        protected override void Activate()
        {
            if (Time.time < readyTime) return;
            readyTime = Time.time + 0.7f;
            StartCoroutine(Punch());
        }

        IEnumerator Punch()
        {
            P.Play(Res.Punch);
            P.TipBody.velocity += P.AxisDown * 10f;
            yield return new WaitForSeconds(0.07f);
            float L = P.WorldLength;
            Vector2 fist = P.TipWorld + P.AxisDown * L * 0.1f;
            Color cyan = new Color(0.35f, 0.92f, 1f, 1f);
            FX.Shockwave(fist, cyan, L * 0.8f, P.Renderer);
            FX.Spray(Res.Spark, fist, P.AxisDown, 50f, cyan, 14, L * 5f, L * 0.05f, 0f, 0.35f, 0f, P.Renderer);
            FX.Blast(fist, L * 0.7f, 16f, P, true);
        }
    }

    /// <summary>Drill arm: toggles a spinning drill that shoves, grinds and sparks against anything it touches.</summary>
    public class DrillSpin : ProstheticAbility
    {
        AudioSource loop;
        bool spinning;
        int frame;
        float frameTimer;
        float sparkTimer;
        float boneTimer;

        void Start()
        {
            loop = gameObject.AddComponent<AudioSource>();
            loop.clip = Res.DrillLoop;
            loop.loop = true;
            loop.playOnAwake = false;
            loop.spatialBlend = 0f;
            loop.volume = 0.7f;
            loop.outputAudioMixerGroup = P.AudioTemplate.outputAudioMixerGroup;
        }

        protected override void Activate()
        {
            spinning = !spinning;
            if (spinning) loop.Play();
            else
            {
                loop.Stop();
                P.TipRenderer.sprite = Res.DrillFrames[0];
            }
        }

        void Update()
        {
            if (!spinning || Time.deltaTime <= 0f) return;
            loop.pitch = Time.timeScale;
            frameTimer -= Time.deltaTime;
            if (frameTimer <= 0f)
            {
                frameTimer = 0.03f;
                frame = (frame + 1) % Res.DrillFrames.Length;
                P.TipRenderer.sprite = Res.DrillFrames[frame];
            }
        }

        void FixedUpdate()
        {
            if (!spinning) return;
            float L = P.WorldLength;
            Vector2 tip = P.TipWorld;
            Vector2 dir = P.AxisDown;
            Vector2 side = new Vector2(-dir.y, dir.x);
            sparkTimer -= Time.fixedDeltaTime;
            boneTimer -= Time.fixedDeltaTime;
            bool touching = false;
            foreach (Collider2D c in Physics2D.OverlapCircleAll(tip, L * 0.14f, P.CollisionMask))
            {
                if (c.isTrigger || P.IsOwnBody(c)) continue;
                touching = true;
                Rigidbody2D rb = c.attachedRigidbody;
                if (rb != null && rb.bodyType == RigidbodyType2D.Dynamic)
                {
                    float m = Mathf.Min(rb.mass, 6f);
                    rb.AddForceAtPosition((dir * 40f + side * UnityEngine.Random.Range(-25f, 25f)) * m, tip);
                    if (boneTimer <= 0f) rb.SendMessage("BreakBone", SendMessageOptions.DontRequireReceiver);
                    if (sparkTimer <= 0f && IsPerson(rb)) FX.Blood(tip, -dir, 3, L, P.Renderer);
                }
                else
                {
                    // Grinding into the ground or a wall pushes the wearer back.
                    P.TipBody.AddForce(-dir * 35f * P.TipBody.mass);
                }
            }
            if (touching)
            {
                if (boneTimer <= 0f) boneTimer = 0.8f;
                if (sparkTimer <= 0f)
                {
                    sparkTimer = 0.04f;
                    FX.Spray(Res.Spark, tip, -dir, 70f, new Color(1f, 0.8f, 0.35f), 3, L * 4f, L * 0.05f, 0f, 0.3f, L * 6f, P.Renderer);
                }
            }
            // Motor vibration.
            P.TipBody.AddTorque(UnityEngine.Random.Range(-1f, 1f) * P.TipBody.inertia * 600f);
        }

        void OnDisable()
        {
            spinning = false;
            if (loop != null) loop.Stop();
        }
    }

    /// <summary>Rocket leg: toggles a thruster strong enough to lift the wearer. Chaos guaranteed.</summary>
    public class RocketThruster : ProstheticAbility
    {
        AudioSource loop;
        GameObject flameLight;
        bool burning;
        float massTimer;
        float liftMass;
        List<Rigidbody2D> bodies = new List<Rigidbody2D>();
        float flameTimer;

        void Start()
        {
            loop = gameObject.AddComponent<AudioSource>();
            loop.clip = Res.RocketLoop;
            loop.loop = true;
            loop.playOnAwake = false;
            loop.spatialBlend = 0f;
            loop.volume = 0.8f;
            loop.outputAudioMixerGroup = P.AudioTemplate.outputAudioMixerGroup;
            flameLight = ModAPI.CreateLight(P.TipTransform, new Color(1f, 0.6f, 0.2f), 4f, 1.6f).gameObject;
            flameLight.transform.localPosition = P.TipLocal;
            flameLight.SetActive(false);
        }

        protected override void Activate()
        {
            burning = !burning;
            flameLight.SetActive(burning);
            if (burning)
            {
                P.Play(Res.RocketIgnite);
                loop.Play();
                massTimer = 0f;
            }
            else loop.Stop();
        }

        void FixedUpdate()
        {
            if (!burning) return;
            massTimer -= Time.fixedDeltaTime;
            if (massTimer <= 0f)
            {
                massTimer = 0.5f;
                bodies = P.WearerBodies();
                liftMass = 0f;
                foreach (Rigidbody2D rb in bodies) if (rb != null) liftMass += rb.mass;
            }
            // Part of the thrust goes through the leg itself (so it steers and tumbles), the rest is
            // shared across the wearer so the hip joint isn't torn apart by a light leg hauling a heavy body.
            Vector2 thrust = -P.AxisDown * liftMass * Physics2D.gravity.magnitude * 1.5f;
            P.TipBody.AddForce(thrust * 0.35f);
            if (liftMass <= 0f) return;
            foreach (Rigidbody2D rb in bodies) if (rb != null) rb.AddForce(thrust * 0.65f * rb.mass / liftMass);
        }

        void Update()
        {
            if (!burning || Time.deltaTime <= 0f) return;
            loop.pitch = Time.timeScale;
            flameTimer -= Time.deltaTime;
            if (flameTimer > 0f) return;
            flameTimer = 0.016f;
            float L = P.WorldLength;
            Vector2 nozzle = P.TipWorld;
            Vector2 dir = P.AxisDown;
            Vector2 baseVel = P.TipBody.velocity;
            FX.Particle(Res.Glow, nozzle, baseVel + dir * L * 6f, new Color(1f, 0.95f, 0.6f, 1f), L * 0.22f, L * 0.05f, 0.12f, 0f, 0f, P.Renderer);
            FX.Particle(Res.Glow, nozzle, baseVel + (Vector2)(Quaternion.Euler(0, 0, UnityEngine.Random.Range(-12f, 12f)) * dir) * L * 5f,
                new Color(1f, 0.5f, 0.1f, 0.9f), L * 0.28f, L * 0.1f, 0.22f, 0f, 0f, P.Renderer);
            if (UnityEngine.Random.value < 0.35f)
                FX.Particle(Res.Puff, nozzle + dir * L * 0.2f, baseVel * 0.3f + dir * L * 2f, new Color(0.45f, 0.45f, 0.45f, 0.5f),
                    L * 0.15f, L * 0.6f, 0.9f, -L * 0.6f, 1f, P.Renderer);
        }

        void OnDisable()
        {
            burning = false;
            if (loop != null) loop.Stop();
            if (flameLight != null) flameLight.SetActive(false);
        }
    }

    /// <summary>Flashlight hand: toggles a bright beam.</summary>
    public class Flashlight : ProstheticAbility
    {
        GameObject lamp;
        GameObject beam;
        bool on;

        void Start()
        {
            Vector2 tip = P.TipLocal;
            lamp = ModAPI.CreateLight(P.TipTransform, new Color(1f, 0.93f, 0.75f), 7f, 1.6f).gameObject;
            lamp.transform.localPosition = tip;

            beam = new GameObject("Beam");
            beam.transform.SetParent(P.TipTransform, false);
            SpriteRenderer r = beam.AddComponent<SpriteRenderer>();
            r.sprite = Res.Beam;
            // Beam texture points down with its apex at the top edge; hang it from the lens.
            float pixelScale = Res.Beam.pixelsPerUnit / P.TipRenderer.sprite.pixelsPerUnit;
            beam.transform.localScale = Vector3.one * pixelScale * 1.6f;
            beam.transform.localPosition = new Vector3(tip.x, tip.y - Res.Beam.bounds.extents.y * pixelScale * 1.6f, 0f);
            P.RegisterOverlay(r, 5);
            Apply();
        }

        protected override void Activate()
        {
            on = !on;
            P.Play(Res.Click);
            Apply();
        }

        void Apply()
        {
            lamp.SetActive(on);
            beam.SetActive(on);
        }
    }

    /// <summary>Golden hand: idles with glints of bling; activate for a shower of sparkles.</summary>
    public class Sparkle : ProstheticAbility
    {
        float idleTimer;
        float readyTime;
        static readonly Color Gold = new Color(1f, 0.85f, 0.3f, 1f);

        protected override void Activate()
        {
            if (Time.time < readyTime) return;
            readyTime = Time.time + 0.5f;
            P.Play(Res.Bling);
            float L = P.WorldLength;
            FX.Burst(Res.Spark, P.TipWorld, Gold, 20, L * 3f, L * 0.07f, 0.8f, P.Renderer);
            FX.Burst(Res.Spark, P.TipWorld, Color.white, 10, L * 2f, L * 0.05f, 0.6f, P.Renderer);
            FX.Particle(Res.Glow, P.TipWorld, Vector2.zero, Gold, L * 0.9f, L * 0.1f, 0.25f, 0f, 0f, P.Renderer);
        }

        void Update()
        {
            if (Time.deltaTime <= 0f) return;
            idleTimer -= Time.deltaTime;
            if (idleTimer > 0f) return;
            idleTimer = UnityEngine.Random.Range(0.25f, 0.7f);
            float L = P.WorldLength;
            Vector2 p = Vector2.Lerp(P.AttachWorld, P.TipWorld, UnityEngine.Random.Range(0.2f, 1f))
                + UnityEngine.Random.insideUnitCircle * L * 0.12f;
            FX.Particle(Res.Glow, p, Vector2.up * L * 0.2f, new Color(1f, 0.95f, 0.7f, 0.9f), L * 0.12f, 0f, 0.4f, 0f, 0f, P.Renderer);
        }
    }

    /// <summary>Steampunk arm: vents a scalding blast of steam that shoves everything in front of the hand.</summary>
    public class SteamBlast : ProstheticAbility
    {
        float readyTime;

        protected override void Activate()
        {
            if (Time.time < readyTime) return;
            readyTime = Time.time + 0.6f;
            float L = P.WorldLength;
            Vector2 dir = P.AxisDown;
            Vector2 hand = P.TipWorld;
            P.Play(Res.Steam);
            FX.Spray(Res.Puff, hand, dir, 22f, new Color(0.95f, 0.95f, 0.95f, 0.75f), 18, L * 3.5f, L * 0.1f, L * 0.7f, 0.9f, -L * 0.8f, P.Renderer);
            FX.Spray(Res.Puff, hand, dir, 40f, new Color(0.8f, 0.82f, 0.85f, 0.5f), 10, L * 2f, L * 0.15f, L * 0.9f, 1.3f, -L * 0.5f, P.Renderer);
            FX.Blast(hand + dir * L * 0.45f, L * 0.55f, 11f, P, false);
            P.TipBody.velocity -= dir * 3f;
        }
    }

    /// <summary>Tesla arm: arcs chain lightning through up to four nearby things.</summary>
    public class TeslaZap : ProstheticAbility
    {
        static readonly Color Arc = new Color(0.78f, 0.68f, 1f, 1f);
        float readyTime;

        protected override void Activate()
        {
            if (Time.time < readyTime) return;
            readyTime = Time.time + 0.5f;
            float L = P.WorldLength;
            Vector2 from = P.TipWorld;
            P.Play(Res.Zap);
            FX.Particle(Res.Glow, from, Vector2.zero, Arc, L * 0.7f, L * 0.1f, 0.15f, 0f, 0f, P.Renderer);

            System.Collections.Generic.HashSet<Rigidbody2D> hit = new System.Collections.Generic.HashSet<Rigidbody2D>();
            for (int jump = 0; jump < 4; jump++)
            {
                Rigidbody2D next = null;
                Vector2 nextPoint = Vector2.zero;
                float best = float.MaxValue;
                foreach (Collider2D c in Physics2D.OverlapCircleAll(from, L * 2.2f, P.CollisionMask))
                {
                    Rigidbody2D rb = c.attachedRigidbody;
                    if (c.isTrigger || rb == null || rb.bodyType != RigidbodyType2D.Dynamic || hit.Contains(rb) || P.IsOwnBody(c)) continue;
                    Vector2 point = c.ClosestPoint(from);
                    float d = Vector2.Distance(point, from);
                    if (d < best)
                    {
                        best = d;
                        next = rb;
                        nextPoint = point;
                    }
                }
                if (next == null) break;
                hit.Add(next);
                Bolt(from, nextPoint, L);
                Vector2 push = (nextPoint - from).normalized;
                next.AddForce(push * 6f * Mathf.Min(next.mass, 6f), ForceMode2D.Impulse);
                next.angularVelocity += UnityEngine.Random.Range(-400f, 400f);
                if (UnityEngine.Random.value < 0.25f) next.SendMessage("BreakBone", SendMessageOptions.DontRequireReceiver);
                FX.Burst(Res.Spark, nextPoint, Arc, 8, L * 3f, L * 0.05f, 0.3f, P.Renderer);
                from = nextPoint;
            }
            if (hit.Count == 0)
            {
                // Nothing in reach: crackle into thin air.
                Bolt(from, from + (Vector2)(Quaternion.Euler(0f, 0f, UnityEngine.Random.Range(-40f, 40f)) * P.AxisDown) * L * 0.8f, L);
            }
        }

        /// <summary>A jagged lightning bolt drawn from short-lived glow particles.</summary>
        void Bolt(Vector2 a, Vector2 b, float L)
        {
            Vector2 d = b - a;
            float length = d.magnitude;
            if (length < 0.001f) return;
            Vector2 side = new Vector2(-d.y, d.x) / length;
            int steps = Mathf.Clamp((int)(length / (L * 0.045f)), 4, 60);
            float wander = 0f;
            for (int i = 0; i <= steps; i++)
            {
                float t = i / (float)steps;
                wander = Mathf.Clamp(wander + UnityEngine.Random.Range(-1f, 1f) * L * 0.05f, -L * 0.12f, L * 0.12f);
                float taper = Mathf.Sin(t * Mathf.PI); // pinned at both ends
                Vector2 p = a + d * t + side * wander * taper;
                FX.Particle(Res.Glow, p, Vector2.zero, Arc, L * 0.09f, 0f, 0.14f, 0f, 0f, P.Renderer);
                if (i % 3 == 0) FX.Particle(Res.Spark, p, Vector2.zero, Color.white, L * 0.04f, 0f, 0.1f, 0f, 0f, P.Renderer);
            }
        }
    }

    /// <summary>Roller skate (rolls almost without friction) and flipper feet: activate to kick off forward.</summary>
    public class SkateBoost : ProstheticAbility
    {
        public float Power = 6f;
        public bool Slippery = true;
        public AudioClip Sound;
        float readyTime;

        void Start()
        {
            if (!Slippery) return;
            PhysicsMaterial2D wheels = new PhysicsMaterial2D("Skate wheels");
            wheels.friction = 0.02f;
            wheels.bounciness = 0f;
            foreach (Collider2D c in GetComponents<Collider2D>()) c.sharedMaterial = wheels;
        }

        protected override void Activate()
        {
            if (Time.time < readyTime || !P.Grounded) return;
            readyTime = Time.time + 0.4f;
            Vector2 forward = new Vector2(Mathf.Sign(transform.localScale.x), 0f);
            foreach (Rigidbody2D rb in P.WearerBodies()) rb.velocity += forward * Power;
            P.Play(Sound != null ? Sound : Res.Spring, 0.7f);
            float L = P.WorldLength;
            FX.Spray(Res.Puff, P.TipWorld, -forward, 25f, new Color(0.85f, 0.8f, 0.7f, 0.7f), 6, L * 6f, L * 0.4f, L * 1f, 0.5f, 0f, P.Renderer);
            FX.Spray(Res.Spark, P.TipWorld, -forward, 20f, new Color(1f, 0.85f, 0.4f), 6, L * 8f, L * 0.12f, 0f, 0.3f, 0f, P.Renderer);
        }
    }

    /// <summary>Cyber limbs: an always-on cyan core glow (no activation).</summary>
    public class CoreGlow : MonoBehaviour
    {
        public Vector2 CorePixel;

        void Start()
        {
            ProstheticBehaviour p = GetComponent<ProstheticBehaviour>();
            LightSprite light = ModAPI.CreateLight(transform, new Color(0.3f, 0.9f, 1f), 1.6f, 0.8f);
            light.transform.localPosition = p.PixelToLocal(CorePixel);
        }
    }
}
