using System.Collections.Generic;
using UnityEngine;

namespace BionicProsthetics
{
    /// <summary>Every sprite and sound the mod uses, loaded once while the mod initialises.</summary>
    public static class Res
    {
        public static Sprite Spark, Glow, Puff, Plasma, Ring, Beam;
        public static Sprite PogoSquash, ClawClosed, LoaderClawClosed;
        public static Sprite[] DrillFrames;
        public static AudioClip Attach, Detach, PlasmaFire, PlasmaHit, Punch, Boing, Spring, Leap,
            Grab, Release, DrillLoop, RocketLoop, RocketIgnite, Click, Bling, Steam, Zap;

        public static void Load()
        {
            Spark = ModAPI.LoadSprite("fx/spark.png");
            Glow = ModAPI.LoadSprite("fx/glow.png");
            Puff = ModAPI.LoadSprite("fx/puff.png");
            Plasma = ModAPI.LoadSprite("fx/plasma.png");
            Ring = ModAPI.LoadSprite("fx/ring.png");
            Beam = ModAPI.LoadSprite("fx/beam.png");
            PogoSquash = ModAPI.LoadSprite("sprites/pogo_leg_squash.png");
            ClawClosed = ModAPI.LoadSprite("sprites/claw_closed.png");
            LoaderClawClosed = ModAPI.LoadSprite("sprites/loader_arm_lower_closed.png");
            DrillFrames = new Sprite[]
            {
                ModAPI.LoadSprite("sprites/drill_arm_0.png"),
                ModAPI.LoadSprite("sprites/drill_arm_1.png"),
                ModAPI.LoadSprite("sprites/drill_arm_2.png")
            };

            Attach = ModAPI.LoadSound("sfx/attach.wav");
            Detach = ModAPI.LoadSound("sfx/detach.wav");
            PlasmaFire = ModAPI.LoadSound("sfx/plasma_fire.wav");
            PlasmaHit = ModAPI.LoadSound("sfx/plasma_hit.wav");
            Punch = ModAPI.LoadSound("sfx/punch.wav");
            Boing = ModAPI.LoadSound("sfx/boing.wav");
            Spring = ModAPI.LoadSound("sfx/spring.wav");
            Leap = ModAPI.LoadSound("sfx/leap.wav");
            Grab = ModAPI.LoadSound("sfx/grab.wav");
            Release = ModAPI.LoadSound("sfx/release.wav");
            DrillLoop = ModAPI.LoadSound("sfx/drill_loop.wav");
            RocketLoop = ModAPI.LoadSound("sfx/rocket_loop.wav");
            RocketIgnite = ModAPI.LoadSound("sfx/rocket_ignite.wav");
            Click = ModAPI.LoadSound("sfx/click.wav");
            Bling = ModAPI.LoadSound("sfx/bling.wav");
            Steam = ModAPI.LoadSound("sfx/steam.wav");
            Zap = ModAPI.LoadSound("sfx/zap.wav");
        }
    }

    /// <summary>A tiny self-contained particle: moves, fades, shrinks or grows, then cleans itself up.</summary>
    public class FXParticle : MonoBehaviour
    {
        public Vector2 Velocity;
        public float Gravity;
        public float Drag;
        public float Life = 0.5f;
        public float StartSize = 0.1f;
        public float EndSize;
        public Color Tint = Color.white;

        SpriteRenderer sr;
        float age;

        void Start()
        {
            sr = GetComponent<SpriteRenderer>();
        }

        void Update()
        {
            float dt = Time.deltaTime;
            if (dt <= 0f) return;
            age += dt;
            if (age >= Life)
            {
                Destroy(gameObject);
                return;
            }
            Velocity += Vector2.down * Gravity * dt;
            Velocity *= Mathf.Max(0f, 1f - Drag * dt);
            transform.position += (Vector3)(Velocity * dt);
            float t = age / Life;
            transform.localScale = Vector3.one * Mathf.Lerp(StartSize, EndSize, t);
            Color c = Tint;
            c.a = Tint.a * (1f - t * t);
            sr.color = c;
        }
    }

    public static class FX
    {
        /// <summary>Spawns one particle; size is the world-space width of the sprite.</summary>
        public static FXParticle Particle(Sprite sprite, Vector2 pos, Vector2 velocity, Color tint, float size, float endSize,
            float life, float gravity, float drag, SpriteRenderer sortAbove)
        {
            GameObject go = new GameObject("Bionic FX");
            go.transform.position = new Vector3(pos.x, pos.y, 0f);
            SpriteRenderer r = go.AddComponent<SpriteRenderer>();
            r.sprite = sprite;
            r.color = tint;
            if (sortAbove != null)
            {
                r.sortingLayerID = sortAbove.sortingLayerID;
                r.sortingOrder = sortAbove.sortingOrder + 20;
            }
            float spriteWidth = Mathf.Max(0.001f, sprite.bounds.size.x);
            FXParticle p = go.AddComponent<FXParticle>();
            p.Velocity = velocity;
            p.Tint = tint;
            p.StartSize = size / spriteWidth;
            p.EndSize = endSize / spriteWidth;
            p.Life = life;
            p.Gravity = gravity;
            p.Drag = drag;
            go.transform.localScale = Vector3.one * p.StartSize;
            return p;
        }

        /// <summary>A radial spray of particles.</summary>
        public static void Burst(Sprite sprite, Vector2 pos, Color tint, int count, float speed, float size, float life, SpriteRenderer sortAbove)
        {
            for (int i = 0; i < count; i++)
            {
                Vector2 v = Random.insideUnitCircle.normalized * speed * Random.Range(0.3f, 1f);
                Particle(sprite, pos, v, tint, size * Random.Range(0.6f, 1.3f), 0f, life * Random.Range(0.6f, 1.2f), speed * 0.8f, 2f, sortAbove);
            }
        }

        /// <summary>A spray of particles in a cone around a direction.</summary>
        public static void Spray(Sprite sprite, Vector2 pos, Vector2 dir, float spreadDegrees, Color tint, int count, float speed,
            float size, float endSize, float life, float gravity, SpriteRenderer sortAbove)
        {
            for (int i = 0; i < count; i++)
            {
                Vector2 v = (Vector2)(Quaternion.Euler(0f, 0f, Random.Range(-spreadDegrees, spreadDegrees)) * dir) * speed * Random.Range(0.5f, 1f);
                Particle(sprite, pos, v, tint, size * Random.Range(0.7f, 1.2f), endSize, life * Random.Range(0.7f, 1.2f), gravity, 3f, sortAbove);
            }
        }

        /// <summary>An expanding shockwave ring.</summary>
        public static void Shockwave(Vector2 pos, Color tint, float radius, SpriteRenderer sortAbove)
        {
            Particle(Res.Ring, pos, Vector2.zero, tint, radius * 0.2f, radius * 2f, 0.3f, 0f, 0f, sortAbove);
            Particle(Res.Glow, pos, Vector2.zero, new Color(tint.r, tint.g, tint.b, 0.8f), radius * 1.2f, radius * 0.2f, 0.18f, 0f, 0f, sortAbove);
        }

        /// <summary>
        /// Pushes every loose body near a point away from it. The source prosthetic and its wearer are never hit.
        /// Bodies close to the centre can have bones broken.
        /// </summary>
        public static void Blast(Vector2 pos, float radius, float speed, ProstheticBehaviour source, bool breakBones)
        {
            int mask = source != null ? source.CollisionMask : Physics2D.DefaultRaycastLayers;
            HashSet<Rigidbody2D> done = new HashSet<Rigidbody2D>();
            foreach (Collider2D c in Physics2D.OverlapCircleAll(pos, radius, mask))
            {
                if (c.isTrigger) continue;
                Rigidbody2D rb = c.attachedRigidbody;
                if (rb == null || rb.bodyType != RigidbodyType2D.Dynamic || !done.Add(rb)) continue;
                if (source != null && source.IsOwnBody(c)) continue;
                Vector2 d = rb.worldCenterOfMass - pos;
                float dist = d.magnitude;
                Vector2 dir = dist > 0.001f ? d / dist : Random.insideUnitCircle.normalized;
                float falloff = 1f - Mathf.Clamp01(dist / radius);
                // Light things fly at full speed, heavy things get a proportionally smaller shove.
                rb.AddForce(dir * speed * (0.35f + 0.65f * falloff) * Mathf.Min(rb.mass, 6f), ForceMode2D.Impulse);
                if (breakBones && falloff > 0.5f) rb.SendMessage("BreakBone", SendMessageOptions.DontRequireReceiver);
            }
        }

        /// <summary>Plays a sound at a position with no owner (e.g. a projectile that is about to be destroyed).</summary>
        public static void PlayAt(AudioClip clip, Vector2 pos, float volume, AudioSource template)
        {
            if (clip == null) return;
            GameObject go = new GameObject("Bionic Sound");
            go.transform.position = pos;
            AudioSource a = go.AddComponent<AudioSource>();
            a.spatialBlend = 0f;
            if (template != null) a.outputAudioMixerGroup = template.outputAudioMixerGroup;
            a.PlayOneShot(clip, volume);
            Object.Destroy(go, clip.length + 0.1f);
        }
    }
}
