package dev.thunderforge;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.BlockParticleOption;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.DamageTypeTags;
import net.minecraft.util.RandomSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.damagesource.DamageTypes;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityTypes;
import net.minecraft.world.entity.LightningBolt;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.monster.Enemy;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.EntityHitResult;
import net.minecraft.world.phys.Vec3;

import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;

/**
 * All of the Storm Hammer's abilities. Everything runs on the logical server, so the mod
 * works in singleplayer and on dedicated servers (clients only need it for the item's assets).
 */
public final class StormPowers {
	private static final double CHAIN_RANGE = 7.0;
	private static final double STORM_RANGE = 20.0;
	private static final int MAX_LEAP_TICKS = 20 * 10;

	private static final Map<UUID, Leap> LEAPS = new HashMap<>();
	private static final Map<UUID, Long> FALL_IMMUNE_UNTIL = new HashMap<>();
	private static final List<Task> TASKS = new ArrayList<>();
	private static long tick;

	private record Task(long runAt, Runnable action) {
	}

	private static final class Leap {
		final long startTick;
		double peakY;
		boolean diving;

		Leap(long startTick, double y) {
			this.startTick = startTick;
			this.peakY = y;
		}
	}

	private StormPowers() {
	}

	static void init() {
		ServerTickEvents.END_SERVER_TICK.register(StormPowers::onServerTick);
		AttackEntityCallback.EVENT.register(StormPowers::onAttack);
		ServerLivingEntityEvents.ALLOW_DAMAGE.register(StormPowers::allowDamage);
		ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
			LEAPS.clear();
			FALL_IMMUNE_UNTIL.clear();
			TASKS.clear();
		});
	}

	private static void schedule(int delay, Runnable action) {
		TASKS.add(new Task(tick + delay, action));
	}

	// ---------------------------------------------------------------------------------------------
	// Leap, meteor dive and ground slam
	// ---------------------------------------------------------------------------------------------

	static void leap(ServerLevel level, Player player) {
		Vec3 look = player.getLookAngle();
		Vec3 flat = new Vec3(look.x, 0, look.z);
		if (flat.lengthSqr() > 1.0E-4) {
			flat = flat.normalize();
		}

		player.setDeltaMovement(flat.x * 1.4, 1.15 + Math.max(0, look.y) * 0.5, flat.z * 1.4);
		player.hurtMarked = true;
		LEAPS.put(player.getUUID(), new Leap(tick, player.getY()));

		level.sendParticles(ParticleTypes.CLOUD, player.getX(), player.getY() + 0.1, player.getZ(), 24, 0.5, 0.05, 0.5, 0.08);
		level.sendParticles(ParticleTypes.ELECTRIC_SPARK, player.getX(), player.getY() + 0.5, player.getZ(), 30, 0.4, 0.4, 0.4, 0.5);
		level.playSound((Player) null, player.getX(), player.getY(), player.getZ(), SoundEvents.ENDER_DRAGON_FLAP, SoundSource.PLAYERS, 1.0f, 1.3f);
		level.playSound((Player) null, player.getX(), player.getY(), player.getZ(), SoundEvents.LIGHTNING_BOLT_IMPACT, SoundSource.PLAYERS, 0.5f, 1.8f);
	}

	private static void tickLeaps(MinecraftServer server) {
		Iterator<Map.Entry<UUID, Leap>> it = LEAPS.entrySet().iterator();

		while (it.hasNext()) {
			Map.Entry<UUID, Leap> entry = it.next();
			Leap leap = entry.getValue();
			ServerPlayer player = server.getPlayerList().getPlayer(entry.getKey());

			if (player == null || !player.isAlive() || tick - leap.startTick > MAX_LEAP_TICKS
					|| !(player.level() instanceof ServerLevel level)) {
				it.remove();
				continue;
			}

			long airTime = tick - leap.startTick;
			leap.peakY = Math.max(leap.peakY, player.getY());

			// Sneak mid-air to turn the leap into a meteor dive.
			if (!leap.diving && airTime > 4 && player.isShiftKeyDown() && !player.onGround()) {
				leap.diving = true;
				Vec3 look = player.getLookAngle();
				player.setDeltaMovement(look.x * 0.6, -2.4, look.z * 0.6);
				player.hurtMarked = true;
				level.playSound((Player) null, player.getX(), player.getY(), player.getZ(), SoundEvents.LIGHTNING_BOLT_THUNDER, SoundSource.PLAYERS, 0.6f, 2.0f);
			}

			if (leap.diving) {
				level.sendParticles(ParticleTypes.ELECTRIC_SPARK, player.getX(), player.getY() + 0.8, player.getZ(), 12, 0.3, 0.6, 0.3, 0.3);
				level.sendParticles(ParticleTypes.FLAME, player.getX(), player.getY() + 0.4, player.getZ(), 6, 0.25, 0.4, 0.25, 0.02);
			} else {
				level.sendParticles(ParticleTypes.ELECTRIC_SPARK, player.getX(), player.getY() + 0.5, player.getZ(), 3, 0.25, 0.3, 0.25, 0.1);
			}

			if (airTime > 3 && (player.onGround() || player.isInWater())) {
				it.remove();
				FALL_IMMUNE_UNTIL.put(player.getUUID(), tick + 10);

				if (player.onGround()) {
					slam(level, player, leap.peakY - player.getY(), leap.diving);
				}
			}
		}
	}

	private static void slam(ServerLevel level, Player player, double fallHeight, boolean dive) {
		float power = (float) Math.min(1.0 + Math.max(0, fallHeight) / 5.0, 4.0);
		if (dive) {
			power *= 1.5f;
		}

		final float finalPower = power;
		final double radius = 3.5 + power * 1.6;
		final Vec3 center = player.position();

		level.playSound((Player) null, center.x, center.y, center.z, SoundEvents.MACE_SMASH_GROUND_HEAVY, SoundSource.PLAYERS, 1.3f, 0.8f);
		level.playSound((Player) null, center.x, center.y, center.z, SoundEvents.LIGHTNING_BOLT_IMPACT, SoundSource.PLAYERS, 1.0f + power * 0.3f, 0.6f);
		if (power >= 2.5f) {
			level.playSound((Player) null, center.x, center.y, center.z, SoundEvents.WARDEN_SONIC_BOOM, SoundSource.PLAYERS, 1.0f, 1.4f);
		}

		level.sendParticles(power >= 3.0f ? ParticleTypes.EXPLOSION_EMITTER : ParticleTypes.EXPLOSION, center.x, center.y + 0.2, center.z, 1, 0, 0, 0, 0);
		level.sendParticles(ParticleTypes.ELECTRIC_SPARK, center.x, center.y + 0.5, center.z, (int) (40 * power), 1.0, 0.5, 1.0, 0.6);

		// An expanding shockwave ring that rolls outward over a few ticks.
		int rings = 7;
		for (int i = 1; i <= rings; i++) {
			double r = radius * i / rings;
			schedule(i, () -> shockwaveRing(level, center, r));
		}

		DamageSource source = level.damageSources().playerAttack(player);
		AABB area = new AABB(center, center).inflate(radius, 2.5, radius);

		for (LivingEntity target : level.getEntitiesOfClass(LivingEntity.class, area, e -> isValidTarget(player, e))) {
			double dist = target.position().distanceTo(center);
			if (dist > radius) {
				continue;
			}

			double falloff = 1.0 - (dist / radius) * 0.6;
			target.hurtServer(level, source, (float) ((3.0 + finalPower * 3.5) * falloff));
			target.knockback(0.6 + finalPower * 0.45 * falloff, center.x - target.getX(), center.z - target.getZ());
			target.setDeltaMovement(target.getDeltaMovement().add(0, 0.35 + 0.12 * finalPower, 0));
			target.hurtMarked = true;
		}

		// Huge impacts call down a crown of lightning around the crater.
		if (power >= 3.0f) {
			for (int i = 0; i < 4; i++) {
				double angle = Math.PI / 2 * i + Math.PI / 4;
				Vec3 pos = new Vec3(center.x + Math.cos(angle) * radius * 0.8, center.y, center.z + Math.sin(angle) * radius * 0.8);
				schedule(2 + i * 2, () -> strike(level, player, pos, 8.0f));
			}
		}
	}

	private static void shockwaveRing(ServerLevel level, Vec3 center, double r) {
		int points = Math.max(12, (int) (r * 8));

		for (int i = 0; i < points; i++) {
			double angle = 2 * Math.PI * i / points;
			double x = center.x + Math.cos(angle) * r;
			double z = center.z + Math.sin(angle) * r;

			level.sendParticles(ParticleTypes.CLOUD, x, center.y + 0.15, z, 1, 0, 0.05, 0, 0.02);
			if (i % 2 == 0) {
				level.sendParticles(ParticleTypes.ELECTRIC_SPARK, x, center.y + 0.3, z, 1, 0, 0.1, 0, 0.1);
			}

			BlockState ground = level.getBlockState(BlockPos.containing(x, center.y - 0.5, z));
			if (!ground.isAir()) {
				level.sendParticles(new BlockParticleOption(ParticleTypes.BLOCK, ground), x, center.y + 0.1, z, 4, 0.1, 0.1, 0.1, 0.15);
			}
		}
	}

	// ---------------------------------------------------------------------------------------------
	// Chain lightning
	// ---------------------------------------------------------------------------------------------

	private static InteractionResult onAttack(Player player, Level level, InteractionHand hand, Entity entity, EntityHitResult hitResult) {
		if (level instanceof ServerLevel serverLevel
				&& hand == InteractionHand.MAIN_HAND
				&& !player.isSpectator()
				&& player.getMainHandItem().is(ModItems.STORM_HAMMER)
				&& entity instanceof LivingEntity first
				&& player.getAttackStrengthScale(0.5f) > 0.9f) {
			chainLightning(serverLevel, player, first);
		}

		return InteractionResult.PASS;
	}

	private static void chainLightning(ServerLevel level, Player player, LivingEntity first) {
		int jumps = level.isThundering() ? 8 : 4;
		Set<UUID> hit = new HashSet<>();
		hit.add(first.getUUID());

		level.sendParticles(ParticleTypes.ELECTRIC_SPARK, first.getX(), first.getY(0.5), first.getZ(), 25, 0.3, 0.4, 0.3, 0.4);
		level.playSound((Player) null, first.getX(), first.getY(), first.getZ(), SoundEvents.LIGHTNING_BOLT_IMPACT, SoundSource.PLAYERS, 0.6f, 1.6f);

		chainJump(level, player, first, hit, jumps, 0);
	}

	private static void chainJump(ServerLevel level, Player player, LivingEntity from, Set<UUID> hit, int remaining, int index) {
		if (remaining <= 0 || !player.isAlive()) {
			return;
		}

		LivingEntity next = null;
		double best = CHAIN_RANGE * CHAIN_RANGE;

		for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, from.getBoundingBox().inflate(CHAIN_RANGE),
				e -> isValidTarget(player, e) && !hit.contains(e.getUUID()))) {
			double d = e.distanceToSqr(from);
			if (d < best) {
				best = d;
				next = e;
			}
		}

		if (next == null) {
			return;
		}

		LivingEntity target = next;
		Vec3 start = from.position().add(0, from.getBbHeight() * 0.6, 0);
		hit.add(target.getUUID());

		schedule(3, () -> {
			if (!target.isAlive()) {
				return;
			}

			Vec3 end = target.position().add(0, target.getBbHeight() * 0.6, 0);
			arc(level, start, end);

			float damage = (float) (6.0 * Math.pow(0.85, index));
			target.hurtServer(level, level.damageSources().playerAttack(player), damage);
			level.sendParticles(ParticleTypes.ELECTRIC_SPARK, end.x, end.y, end.z, 15, 0.25, 0.3, 0.25, 0.3);
			level.playSound((Player) null, end.x, end.y, end.z, SoundEvents.LIGHTNING_BOLT_IMPACT, SoundSource.PLAYERS, 0.5f, 1.4f + index * 0.1f);

			chainJump(level, player, target, hit, remaining - 1, index + 1);
		});
	}

	/** Draws a jagged bolt of sparks between two points. */
	private static void arc(ServerLevel level, Vec3 a, Vec3 b) {
		RandomSource random = level.getRandom();
		Vec3 delta = b.subtract(a);
		int segments = Math.max(6, (int) (delta.length() * 4));

		for (int i = 0; i <= segments; i++) {
			double t = (double) i / segments;
			double jitter = Math.sin(Math.PI * t) * 0.35;
			double x = a.x + delta.x * t + random.nextGaussian() * jitter;
			double y = a.y + delta.y * t + random.nextGaussian() * jitter;
			double z = a.z + delta.z * t + random.nextGaussian() * jitter;

			level.sendParticles(ParticleTypes.ELECTRIC_SPARK, x, y, z, 1, 0, 0, 0, 0);
			if (i % 3 == 0) {
				level.sendParticles(ParticleTypes.END_ROD, x, y, z, 1, 0, 0, 0, 0);
			}
		}
	}

	// ---------------------------------------------------------------------------------------------
	// Storm Call
	// ---------------------------------------------------------------------------------------------

	static void callStorm(ServerLevel level, Player player) {
		Vec3 center = player.position();

		List<LivingEntity> targets = level.getEntitiesOfClass(LivingEntity.class, player.getBoundingBox().inflate(STORM_RANGE, 8, STORM_RANGE),
				e -> e instanceof Enemy && isValidTarget(player, e));
		targets.sort(Comparator.comparingDouble(e -> e.distanceToSqr(player)));

		level.playSound((Player) null, center.x, center.y, center.z, SoundEvents.LIGHTNING_BOLT_THUNDER, SoundSource.WEATHER, 2.0f, 0.7f);
		level.sendParticles(ParticleTypes.ELECTRIC_SPARK, center.x, center.y + 2.5, center.z, 80, 0.3, 1.5, 0.3, 0.8);
		level.sendParticles(ParticleTypes.END_ROD, center.x, center.y + 1.0, center.z, 30, 0.6, 1.2, 0.6, 0.15);

		int delay = 8;

		// Every hostile in range gets its own bolt, nearest first.
		for (int i = 0; i < Math.min(targets.size(), 12); i++) {
			LivingEntity target = targets.get(i);
			schedule(delay, () -> {
				if (target.isAlive()) {
					strike(level, player, target.position(), 12.0f);
				}
			});
			delay += 4;
		}

		// And a spiral of bolts walks outward from the caster for drama.
		int spiral = 8;
		for (int i = 0; i < spiral; i++) {
			double angle = i * (Math.PI * 2 / spiral) * 1.5;
			double r = 4.0 + i * 1.1;
			Vec3 pos = new Vec3(center.x + Math.cos(angle) * r, center.y, center.z + Math.sin(angle) * r);
			schedule(8 + i * 3, () -> strike(level, player, pos, 12.0f));
		}
	}

	private static void strike(ServerLevel level, Player player, Vec3 pos, float damage) {
		LightningBolt bolt = new LightningBolt(EntityTypes.LIGHTNING_BOLT, level);
		bolt.setPos(pos);
		// Visual only: no fires, no hurting the caster. The damage below is targeted instead.
		bolt.setVisualOnly(true);
		level.addFreshEntity(bolt);

		level.sendParticles(ParticleTypes.ELECTRIC_SPARK, pos.x, pos.y + 0.3, pos.z, 30, 0.6, 0.2, 0.6, 0.4);

		AABB area = new AABB(pos, pos).inflate(2.5, 3.0, 2.5);
		for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, area, e -> isValidTarget(player, e))) {
			e.hurtServer(level, level.damageSources().playerAttack(player), damage);
			e.setRemainingFireTicks(80);
		}
	}

	// ---------------------------------------------------------------------------------------------
	// Shared
	// ---------------------------------------------------------------------------------------------

	private static boolean isValidTarget(Player player, LivingEntity e) {
		if (e == player || !e.isAlive() || e.isSpectator() || e.isAlliedTo(player)) {
			return false;
		}

		if (e instanceof Player other) {
			return !other.isCreative() && player.canHarmPlayer(other);
		}

		return e instanceof Mob;
	}

	private static boolean holdsHammer(LivingEntity entity) {
		return entity.getMainHandItem().is(ModItems.STORM_HAMMER) || entity.getOffhandItem().is(ModItems.STORM_HAMMER);
	}

	private static boolean allowDamage(LivingEntity entity, DamageSource source, float amount) {
		if (source.is(DamageTypeTags.IS_FALL)) {
			UUID id = entity.getUUID();
			if (LEAPS.containsKey(id) || FALL_IMMUNE_UNTIL.getOrDefault(id, -1L) >= tick) {
				return false;
			}
		}

		// Stormborn: whoever wields the hammer cannot be hurt by lightning.
		return !(source.is(DamageTypes.LIGHTNING_BOLT) && holdsHammer(entity));
	}

	private static void onServerTick(MinecraftServer server) {
		tick++;

		if (!TASKS.isEmpty()) {
			List<Task> due = new ArrayList<>();
			TASKS.removeIf(task -> {
				if (task.runAt() <= tick) {
					due.add(task);
					return true;
				}

				return false;
			});

			for (Task task : due) {
				task.action().run();
			}
		}

		tickLeaps(server);
		FALL_IMMUNE_UNTIL.values().removeIf(until -> until < tick);

		// Wielders crackle with static.
		if (tick % 4 == 0) {
			for (ServerPlayer player : server.getPlayerList().getPlayers()) {
				if (!player.isSpectator() && holdsHammer(player) && player.level() instanceof ServerLevel level) {
					int count = level.isThundering() ? 6 : 2;
					level.sendParticles(ParticleTypes.ELECTRIC_SPARK, player.getX(), player.getY() + 1.0, player.getZ(), count, 0.4, 0.5, 0.4, 0.05);
				}
			}
		}
	}
}
