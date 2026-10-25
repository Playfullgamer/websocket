using System;
using UnityEngine;
using UnityEngine.Events;
using BionicProsthetics;

namespace Mod
{
    public class Mod
    {
        static Category category;
        static int registered;
        static string firstError;
        static int failed;

        public static void Main()
        {
            registered = 0;
            failed = 0;
            firstError = null;
            try
            {
                Load();
            }
            catch (Exception e)
            {
                Fail("startup", e);
            }
            // Always say how loading went, so a problem shows up in game instead of as an empty tab.
            if (failed == 0)
                ModAPI.Notify("Bionic Prosthetics: " + registered + " prosthetics ready in the Prosthetics tab");
            else
                ModAPI.Notify("Bionic Prosthetics: " + registered + " loaded, " + failed + " failed. First error: " + firstError);
        }

        static void Fail(string what, Exception e)
        {
            failed++;
            if (firstError == null) firstError = what + " - " + e.GetType().Name + ": " + e.Message;
            Debug.LogError("[Bionic Prosthetics] " + what + " failed: " + e);
        }

        static void Load()
        {
            Res.Load();
            try { ProstheticBehaviour.SegmentPrefab = ModAPI.FindSpawnable("Brick").Prefab; }
            catch { ProstheticBehaviour.SegmentPrefab = null; }
            try { ProstheticBehaviour.HumanPrefab = ModAPI.FindSpawnable("Human").Prefab; }
            catch { ProstheticBehaviour.HumanPrefab = null; }
            category = CreateCategory("Prosthetics", "Replacement limbs for anyone who's lost one - from peg legs to plasma cannons.",
                ModAPI.LoadSprite("category.png"));
            if (category == null) category = FindCategory("Misc.") ?? FindCategory("Entities");
            Sprite medicalForearm = ModAPI.LoadSprite("sprites/medical_arm_lower.png");
            Sprite cyberForearm = ModAPI.LoadSprite("sprites/cyber_arm_lower.png");
            Sprite medicalShin = ModAPI.LoadSprite("sprites/medical_leg_lower.png");
            Sprite cyberShin = ModAPI.LoadSprite("sprites/cyber_leg_lower.png");
            Sprite rocketShin = ModAPI.LoadSprite("sprites/rocket_leg_lower.png");
            Sprite steampunkForearm = ModAPI.LoadSprite("sprites/steampunk_arm_lower.png");
            Sprite teslaForearm = ModAPI.LoadSprite("sprites/tesla_arm_lower.png");
            Sprite loaderForearm = ModAPI.LoadSprite("sprites/loader_arm_lower.png");
            Sprite heavyForearm = ModAPI.LoadSprite("sprites/heavy_cannon_arm_lower.png");
            Sprite pirateForearm = ModAPI.LoadSprite("sprites/pirate_arm_lower.png");

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
                "Swing it hard into someone to impale them on it. Activate to hook onto whatever it touches - people, objects, even walls - and again to let go.",
                p => { p.gameObject.AddComponent<Grabber>().Impales = true; });

            Add("Hydraulic Claw", "claw_open", "claw", ProstheticSlot.Forearm, SpriteData.ClawAttach, SpriteData.ClawTip, "Metal",
                "Industrial pincer arm. Touch it to the UPPER ARM of anyone missing a forearm. " +
                "Activate to clamp onto whatever it touches - people included - and again to release.",
                p => { p.gameObject.AddComponent<Grabber>().ClosedSprite = Res.ClawClosed; });

            Add("Medical Prosthetic Arm", "medical_arm_upper", "medical_arm", ProstheticSlot.FullArm, SpriteData.MedicalArmAttach, SpriteData.MedicalArmTip, "Plastic",
                "A myoelectric arm with a working elbow and an articulated robotic hand. " +
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

            // ---------------------------------------------------------------- feet
            const string footHelp = " Touch it to the LOWER LEG (ankle) of anyone missing a foot.";
            Add("Carbon Flex Foot", "carbon_foot", ProstheticSlot.Foot, SpriteData.CarbonFootAttach, SpriteData.CarbonFootTip, "Plastic",
                "A springy carbon-fibre foot with a heel spring." + footHelp + " Activate for a springy hop.",
                p =>
                {
                    p.LockJoint = true;
                    SpringJump s = p.gameObject.AddComponent<SpringJump>();
                    s.Power = 6f;
                    s.Sound = Res.Spring;
                });

            Add("Cyber Foot", "cyber_foot", ProstheticSlot.Foot, SpriteData.CyberFootAttach, SpriteData.CyberFootTip, "Metal",
                "A chrome boot with a reactor ankle and a glowing sole." + footHelp + " Activate to stomp a shockwave.",
                p =>
                {
                    p.LockJoint = true;
                    SpringJump s = p.gameObject.AddComponent<SpringJump>();
                    s.Power = 8f;
                    s.Sound = Res.Leap;
                    s.Shockwave = true;
                    p.gameObject.AddComponent<CoreGlow>().CorePixel = new Vector2(8f, 8f);
                });

            Add("Pirate Wooden Foot", "wood_foot", ProstheticSlot.Foot, SpriteData.WoodFootAttach, SpriteData.WoodFootTip, "Wood",
                "A carved oak foot with an iron-nailed sole, strapped on with leather." + footHelp,
                p => { p.LockJoint = true; });

            Add("Roller Skate Foot", "skate_foot", ProstheticSlot.Foot, SpriteData.SkateFootAttach, SpriteData.SkateFootTip, "Metal",
                "Why have a foot when you can have wheels? Rolls almost without friction." + footHelp + " Activate to kick off and glide.",
                p =>
                {
                    p.LockJoint = true;
                    p.gameObject.AddComponent<SkateBoost>();
                });

            Add("Rocket Boot", "rocket_boot", ProstheticSlot.Foot, SpriteData.RocketBootAttach, SpriteData.RocketBootTip, "Metal",
                "A boot with a thruster in the heel." + footHelp + " Activate to toggle the thruster. Hold on to something.",
                p =>
                {
                    p.LockJoint = true;
                    p.gameObject.AddComponent<RocketThruster>();
                });

            Add("Spiked Stomper", "spike_foot", ProstheticSlot.Foot, SpriteData.SpikeFootAttach, SpriteData.SpikeFootTip, "Metal",
                "An iron boot with steel spikes on the sole." + footHelp + " Stomp on someone to impale them; activate to pull free.",
                p =>
                {
                    p.LockJoint = true;
                    p.gameObject.AddComponent<Grabber>().Impales = true;
                });

            Add("Magnet Boot", "magnet_boot", ProstheticSlot.Foot, SpriteData.MagnetBootAttach, SpriteData.MagnetBootTip, "Metal",
                "An electromagnetic boot." + footHelp + " Activate to lock onto the floor, a wall or the ceiling (or whatever it touches), again to release.",
                p =>
                {
                    p.LockJoint = true;
                    p.gameObject.AddComponent<Grabber>().PreferSurfaces = true;
                });

            Add("24K Golden Foot", "golden_foot", ProstheticSlot.Foot, SpriteData.GoldenFootAttach, SpriteData.GoldenFootTip, "Metal",
                "Solid gold, sculpted toes, a ruby and an emerald. Utterly impractical." + footHelp + " Activate to show off.",
                p =>
                {
                    p.LockJoint = true;
                    p.gameObject.AddComponent<Sparkle>();
                });

            Add("Scuba Flipper", "flipper_foot", ProstheticSlot.Foot, SpriteData.FlipperFootAttach, SpriteData.FlipperFootTip, "Plastic",
                "A rubber diving fin. Walking is awkward, but it looks great." + footHelp + " Activate for a big flap kick.",
                p =>
                {
                    p.LockJoint = true;
                    SkateBoost flap = p.gameObject.AddComponent<SkateBoost>();
                    flap.Slippery = false;
                    flap.Power = 4f;
                    flap.Sound = Res.Boing;
                });

            // ---------------------------------------------------------------- more full arms (all with a working elbow)
            Add("Steampunk Arm", "steampunk_arm_upper", "steampunk_arm", ProstheticSlot.FullArm, SpriteData.SteampunkArmAttach, SpriteData.SteampunkArmTip, "Metal",
                "Brass and copper, pistons and a pressure gauge. Touch it to the CHEST (upper body) of anyone missing an entire arm. " +
                "Activate to vent a scalding blast of steam.",
                p =>
                {
                    p.BuildSegment(steampunkForearm, SpriteData.SteampunkArmJoint, SpriteData.SteampunkArmLowerJoint, SpriteData.SteampunkArmTip);
                    p.gameObject.AddComponent<SteamBlast>();
                });

            Add("Tesla Arm", "tesla_arm_upper", "tesla_arm", ProstheticSlot.FullArm, SpriteData.TeslaArmAttach, SpriteData.TeslaArmTip, "Metal",
                "Copper coils and a crackling tesla orb. Touch it to the CHEST (upper body) of anyone missing an entire arm. " +
                "Activate to arc chain lightning through everything nearby.",
                p =>
                {
                    p.BuildSegment(teslaForearm, SpriteData.TeslaArmJoint, SpriteData.TeslaArmLowerJoint, SpriteData.TeslaArmTip);
                    p.gameObject.AddComponent<TeslaZap>();
                });

            Add("Loader Claw Arm", "loader_arm_upper", "loader_arm", ProstheticSlot.FullArm, SpriteData.LoaderArmAttach, SpriteData.LoaderArmTip, "Metal",
                "Industrial hydraulic arm with a heavy-duty claw. Touch it to the CHEST (upper body) of anyone missing an entire arm. " +
                "Activate to clamp onto whatever it touches - people, objects, even walls - and again to let go.",
                p =>
                {
                    p.BuildSegment(loaderForearm, SpriteData.LoaderArmJoint, SpriteData.LoaderArmLowerJoint, SpriteData.LoaderArmTip);
                    p.gameObject.AddComponent<Grabber>().ClosedSprite = Res.LoaderClawClosed;
                });

            Add("Heavy Plasma Arm", "heavy_cannon_arm_upper", "heavy_cannon_arm", ProstheticSlot.FullArm, SpriteData.HeavyCannonArmAttach, SpriteData.HeavyCannonArmTip, "Metal",
                "A whole arm turned into a siege cannon. Touch it to the CHEST (upper body) of anyone missing an entire arm. " +
                "Activate to fire huge plasma bolts.",
                p =>
                {
                    p.BuildSegment(heavyForearm, SpriteData.HeavyCannonArmJoint, SpriteData.HeavyCannonArmLowerJoint, SpriteData.HeavyCannonArmTip);
                    p.gameObject.AddComponent<PlasmaCannon>();
                });

            Add("Pirate Arm", "pirate_arm_upper", "pirate_arm", ProstheticSlot.FullArm, SpriteData.PirateArmAttach, SpriteData.PirateArmTip, "Wood",
                "A carved oak arm ending in a hook, for the captain who lost more than a hand. " +
                "Touch it to the CHEST (upper body) of anyone missing an entire arm. Swing it hard into someone to impale them. " +
                "Activate to hook on, again to let go.",
                p =>
                {
                    p.BuildSegment(pirateForearm, SpriteData.PirateArmJoint, SpriteData.PirateArmLowerJoint, SpriteData.PirateArmTip);
                    p.gameObject.AddComponent<Grabber>().Impales = true;
                });

            // ---------------------------------------------------------------- modular upper arms and thighs
            const string armMountHelp = " Touch it to the CHEST of anyone missing an entire arm, then plug ANY forearm prosthetic " +
                "(hook, claw, cannon, drill...) into its elbow. Works on the floor too - build first, fit later.";
            const string legMountHelp = " Touch it to the HIPS of anyone missing an entire leg, then plug ANY lower-leg prosthetic " +
                "(peg leg, running blade, pogo spring) into its knee. Works on the floor too - build first, fit later.";
            AddMount("Modular Upper Arm (Medical)", "medical_arm", ProstheticSlot.UpperArm, SpriteData.MedicalArmAttach, SpriteData.MedicalArmJoint, "Plastic",
                "A medical upper arm with an elbow socket." + armMountHelp);
            AddMount("Modular Upper Arm (Cyber)", "cyber_arm", ProstheticSlot.UpperArm, SpriteData.CyberArmAttach, SpriteData.CyberArmJoint, "Metal",
                "A chrome upper arm with a powered elbow socket." + armMountHelp);
            AddMount("Modular Upper Arm (Steampunk)", "steampunk_arm", ProstheticSlot.UpperArm, SpriteData.SteampunkArmAttach, SpriteData.SteampunkArmJoint, "Metal",
                "A brass upper arm with a geared elbow socket." + armMountHelp);
            AddMount("Modular Upper Arm (Pirate)", "pirate_arm", ProstheticSlot.UpperArm, SpriteData.PirateArmAttach, SpriteData.PirateArmJoint, "Wood",
                "A carved oak upper arm with an iron-bolted elbow socket." + armMountHelp);
            AddMount("Modular Thigh (Medical)", "medical_leg", ProstheticSlot.UpperLeg, SpriteData.MedicalLegAttach, SpriteData.MedicalLegJoint, "Plastic",
                "A thigh socket with a hydraulic knee mount." + legMountHelp);
            AddMount("Modular Thigh (Cyber)", "cyber_leg", ProstheticSlot.UpperLeg, SpriteData.CyberLegAttach, SpriteData.CyberLegJoint, "Metal",
                "An armoured thigh with a reactor knee mount." + legMountHelp);
            AddMount("Modular Thigh (Rocket)", "rocket_leg", ProstheticSlot.UpperLeg, SpriteData.RocketLegAttach, SpriteData.RocketLegJoint, "Metal",
                "A rocket-casing thigh with a bolted knee mount." + legMountHelp);
        }

        /// <summary>A stand-alone upper arm / thigh whose elbow / knee takes another prosthetic.</summary>
        static void AddMount(string name, string art, ProstheticSlot slot, Vector2 attach, Vector2 mount, string material, string description)
        {
            Add(name, art + "_mount", art + "_mount", slot, attach, mount, material, description, p => { p.MountPixel = mount; });
        }

        static void Add(string name, string sprite, ProstheticSlot slot, Vector2 attach, Vector2 tip, string material,
            string description, Action<ProstheticBehaviour> setup)
        {
            Add(name, sprite, sprite, slot, attach, tip, material, description, setup);
        }

        static void Add(string name, string sprite, string thumb, ProstheticSlot slot, Vector2 attach, Vector2 tip, string material,
            string description, Action<ProstheticBehaviour> setup)
        {
            // Each item registers on its own, so one broken item can't take the rest of the mod down with it.
            try
            {
                Register(name, sprite, thumb, slot, attach, tip, material, description, setup);
                registered++;
            }
            catch (Exception e)
            {
                Fail(name, e);
            }
        }

        static void Register(string name, string sprite, string thumb, ProstheticSlot slot, Vector2 attach, Vector2 tip, string material,
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
