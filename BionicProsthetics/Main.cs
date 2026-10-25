using System;
using UnityEngine;
using UnityEngine.Events;
using BionicProsthetics;

namespace Mod
{
    public class Mod
    {
        static Category category;

        public static void Main()
        {
            Res.Load();
            category = CreateCategory("Prosthetics", "Replacement limbs for anyone who's lost one - from peg legs to plasma cannons.",
                ModAPI.LoadSprite("category.png"));
            if (category == null) category = FindCategory("Misc.") ?? FindCategory("Entities");
            Sprite medicalForearm = ModAPI.LoadSprite("sprites/medical_arm_lower.png");
            Sprite cyberForearm = ModAPI.LoadSprite("sprites/cyber_arm_lower.png");
            Sprite medicalShin = ModAPI.LoadSprite("sprites/medical_leg_lower.png");
            Sprite cyberShin = ModAPI.LoadSprite("sprites/cyber_leg_lower.png");
            Sprite rocketShin = ModAPI.LoadSprite("sprites/rocket_leg_lower.png");

            // ---------------------------------------------------------------- legs
            Add("Pirate Peg Leg", "peg_leg", ProstheticSlot.LowerLeg, SpriteData.PegLegAttach, SpriteData.PegLegTip, "Wood",
                "A sturdy oak peg with an iron ferrule. Touch it to the UPPER LEG of anyone missing a lower leg. Arr.",
                p => { p.LockJoint = true; });

            Add("Carbon Running Blade", "running_blade", ProstheticSlot.LowerLeg, SpriteData.RunningBladeAttach, SpriteData.RunningBladeTip, "Plastic",
                "Paralympic-grade carbon fibre blade. Touch it to the UPPER LEG of anyone missing a lower leg. " +
                "Activate to spring into the air.",
                p =>
                {
                    p.LockJoint = true;
                    SpringJump s = p.gameObject.AddComponent<SpringJump>();
                    s.Power = 9f;
                    s.Sound = Res.Spring;
                });

            Add("Pogo Spring Leg", "pogo_leg", ProstheticSlot.LowerLeg, SpriteData.PogoLegAttach, SpriteData.PogoLegTip, "Metal",
                "A heavy-duty coil spring with a rubber ball foot. Touch it to the UPPER LEG of anyone missing a lower leg. " +
                "Activate to BOING.",
                p =>
                {
                    p.LockJoint = true;
                    SpringJump s = p.gameObject.AddComponent<SpringJump>();
                    s.Power = 13f;
                    s.Sound = Res.Boing;
                    s.SquashSprite = Res.PogoSquash;
                });

            Add("Medical Prosthetic Leg", "medical_leg_upper", "medical_leg", ProstheticSlot.FullLeg, SpriteData.MedicalLegAttach, SpriteData.MedicalLegTip, "Plastic",
                "A modern above-knee prosthesis with a working hydraulic knee and a fresh pair of sneakers. " +
                "Touch it to the HIPS (lower body) of anyone missing an entire leg.",
                p => { p.BuildSegment(medicalShin, SpriteData.MedicalLegJoint, SpriteData.MedicalLegLowerJoint, SpriteData.MedicalLegTip); });

            Add("Cyber Leg MK-II", "cyber_leg_upper", "cyber_leg", ProstheticSlot.FullLeg, SpriteData.CyberLegAttach, SpriteData.CyberLegTip, "Metal",
                "Military-grade chrome leg with a glowing reactor knee. Touch it to the HIPS (lower body) of anyone missing an entire leg. " +
                "Activate for a hydraulic leap that knocks everything nearby away.",
                p =>
                {
                    p.BuildSegment(cyberShin, SpriteData.CyberLegJoint, SpriteData.CyberLegLowerJoint, SpriteData.CyberLegTip);
                    SpringJump s = p.gameObject.AddComponent<SpringJump>();
                    s.Power = 14f;
                    s.Sound = Res.Leap;
                    s.Shockwave = true;
                    p.gameObject.AddComponent<CoreGlow>().CorePixel = new Vector2(9f, 34f);
                });

            Add("Rocket Leg", "rocket_leg_upper", "rocket_leg", ProstheticSlot.FullLeg, SpriteData.RocketLegAttach, SpriteData.RocketLegTip, "Metal",
                "Why walk when you can fly? Touch it to the HIPS (lower body) of anyone missing an entire leg. " +
                "Activate to toggle the thruster.",
                p =>
                {
                    p.BuildSegment(rocketShin, SpriteData.RocketLegJoint, SpriteData.RocketLegLowerJoint, SpriteData.RocketLegTip);
                    p.gameObject.AddComponent<RocketThruster>();
                });

            // ---------------------------------------------------------------- arms
            Add("Pirate Hook", "hook", ProstheticSlot.Forearm, SpriteData.HookAttach, SpriteData.HookTip, "Metal",
                "A polished steel hook on a leather cuff. Touch it to the UPPER ARM of anyone missing a forearm. " +
                "Activate to hook onto whatever it touches - even walls - and again to let go.",
                p => { p.gameObject.AddComponent<Grabber>(); });

            Add("Hydraulic Claw", "claw_open", "claw", ProstheticSlot.Forearm, SpriteData.ClawAttach, SpriteData.ClawTip, "Metal",
                "Industrial pincer arm. Touch it to the UPPER ARM of anyone missing a forearm. " +
                "Activate to clamp onto whatever it touches, and again to release.",
                p => { p.gameObject.AddComponent<Grabber>().ClosedSprite = Res.ClawClosed; });

            Add("Medical Prosthetic Arm", "medical_arm_upper", "medical_arm", ProstheticSlot.FullArm, SpriteData.MedicalArmAttach, SpriteData.MedicalArmTip, "Plastic",
                "A myoelectric arm with a working elbow and an articulated hand that mirrors the wearer's other arm. " +
                "Touch it to the CHEST (upper body) of anyone missing an entire arm.",
                p => { p.BuildSegment(medicalForearm, SpriteData.MedicalArmJoint, SpriteData.MedicalArmLowerJoint, SpriteData.MedicalArmTip); });

            Add("Cyber Arm MK-II", "cyber_arm_upper", "cyber_arm", ProstheticSlot.FullArm, SpriteData.CyberArmAttach, SpriteData.CyberArmTip, "Metal",
                "Chrome combat arm with a reactor shoulder and a powered elbow. Touch it to the CHEST (upper body) of anyone missing an entire arm. " +
                "Activate for a rocket-powered punch.",
                p =>
                {
                    p.BuildSegment(cyberForearm, SpriteData.CyberArmJoint, SpriteData.CyberArmLowerJoint, SpriteData.CyberArmTip);
                    p.gameObject.AddComponent<PowerPunch>();
                    p.gameObject.AddComponent<CoreGlow>().CorePixel = new Vector2(9f, 7f);
                });

            Add("Plasma Arm Cannon", "plasma_cannon", ProstheticSlot.Forearm, SpriteData.PlasmaCannonAttach, SpriteData.PlasmaCannonTip, "Metal",
                "Who needs a hand? Touch it to the UPPER ARM of anyone missing a forearm. Activate to fire plasma bolts.",
                p => { p.gameObject.AddComponent<PlasmaCannon>(); });

            Add("Drill Arm", "drill_arm_0", "drill_arm", ProstheticSlot.Forearm, SpriteData.DrillArmAttach, SpriteData.DrillArmTip, "Metal",
                "A mining drill bolted where a hand used to be. Touch it to the UPPER ARM of anyone missing a forearm. " +
                "Activate to toggle the drill.",
                p => { p.gameObject.AddComponent<DrillSpin>(); });

            Add("Flashlight Hand", "flashlight_hand", ProstheticSlot.Forearm, SpriteData.FlashlightHandAttach, SpriteData.FlashlightHandTip, "Metal",
                "Never lose your torch again. Touch it to the UPPER ARM of anyone missing a forearm. Activate to toggle the light.",
                p => { p.gameObject.AddComponent<Flashlight>(); });

            Add("24K Golden Hand", "golden_hand", ProstheticSlot.Forearm, SpriteData.GoldenHandAttach, SpriteData.GoldenHandTip, "Metal",
                "Solid gold, jewel-encrusted, completely impractical. Touch it to the UPPER ARM of anyone missing a forearm. " +
                "Activate to show off.",
                p => { p.gameObject.AddComponent<Sparkle>(); });
        }

        static void Add(string name, string sprite, ProstheticSlot slot, Vector2 attach, Vector2 tip, string material,
            string description, Action<ProstheticBehaviour> setup)
        {
            Add(name, sprite, sprite, slot, attach, tip, material, description, setup);
        }

        static void Add(string name, string sprite, string thumb, ProstheticSlot slot, Vector2 attach, Vector2 tip, string material,
            string description, Action<ProstheticBehaviour> setup)
        {
            Sprite main = ModAPI.LoadSprite("sprites/" + sprite + ".png");
            PhysicalProperties properties = FindProperties(material);
            ModAPI.Register(new Modification()
            {
                OriginalItem = ModAPI.FindSpawnable("Brick"),
                NameOverride = name,
                DescriptionOverride = description,
                CategoryOverride = category,
                ThumbnailOverride = ModAPI.LoadSprite("thumbs/" + thumb + ".png"),
                AfterSpawn = (Instance) =>
                {
                    Instance.GetComponent<SpriteRenderer>().sprite = main;
                    Instance.FixColliders();
                    // Art is drawn at double density; show it at game scale until it is fitted to someone.
                    Vector3 s = Instance.transform.localScale;
                    Instance.transform.localScale = new Vector3(Mathf.Sign(s.x) * 0.5f, 0.5f, 1f);

                    PhysicalBehaviour phys = Instance.GetComponent<PhysicalBehaviour>();
                    if (phys != null && properties != null) phys.Properties = properties;

                    ProstheticBehaviour p = Instance.GetComponent<ProstheticBehaviour>();
                    if (p == null) p = Instance.AddComponent<ProstheticBehaviour>();
                    // If the game ever re-runs this on an existing object, don't stack a second set of abilities.
                    foreach (ProstheticAbility old in Instance.GetComponents<ProstheticAbility>()) UnityEngine.Object.DestroyImmediate(old);
                    foreach (CoreGlow old in Instance.GetComponents<CoreGlow>()) UnityEngine.Object.DestroyImmediate(old);
                    p.DisplayName = name;
                    p.Slot = slot;
                    p.AttachPixel = attach;
                    p.TipPixel = tip;
                    if (setup != null) setup(p);

                    if (phys != null)
                    {
                        phys.ContextMenuOptions.Buttons.Add(new ContextMenuButton("bionicDetach", "Detach prosthetic",
                            "Take this prosthetic off its wearer", new UnityAction[] { () => p.Detach(true) }));
                    }
                }
            });
        }

        /// <summary>Adds our own tab to the spawn menu (or returns it if it already exists).</summary>
        static Category CreateCategory(string name, string description, Sprite icon)
        {
            try
            {
                CatalogBehaviour catalog = UnityEngine.Object.FindObjectOfType<CatalogBehaviour>();
                if (catalog == null) return null;
                Category[] existing = catalog.Catalog.Categories;
                foreach (Category c in existing)
                {
                    if (c != null && c.name == name) return c;
                }
                Category created = ScriptableObject.CreateInstance<Category>();
                created.name = name;
                created.Description = description;
                created.Icon = icon;
                Category[] grown = new Category[existing.Length + 1];
                Array.Copy(existing, grown, existing.Length);
                grown[existing.Length] = created;
                catalog.Catalog.Categories = grown;
                return created;
            }
            catch
            {
                return null;
            }
        }

        static Category FindCategory(string name)
        {
            try { return ModAPI.FindCategory(name); }
            catch { return null; }
        }

        static PhysicalProperties FindProperties(string name)
        {
            try { return ModAPI.FindPhysicalProperties(name); }
            catch { return null; }
        }
    }
}
