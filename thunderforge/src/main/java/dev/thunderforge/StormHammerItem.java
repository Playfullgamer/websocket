package dev.thunderforge;

import java.util.function.Consumer;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.component.TooltipDisplay;
import net.minecraft.world.level.Level;

public class StormHammerItem extends Item {
	public static final int LEAP_COOLDOWN = 30;
	public static final int STORM_COOLDOWN = 20 * 12;

	public StormHammerItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		if (!(level instanceof ServerLevel serverLevel)) {
			return InteractionResult.SUCCESS;
		}

		ItemStack stack = player.getItemInHand(hand);

		if (player.isShiftKeyDown()) {
			StormPowers.callStorm(serverLevel, player);
			player.getCooldowns().addCooldown(stack, STORM_COOLDOWN);
		} else {
			StormPowers.leap(serverLevel, player);
			player.getCooldowns().addCooldown(stack, LEAP_COOLDOWN);
		}

		return InteractionResult.SUCCESS;
	}

	@Override
	public void appendHoverText(ItemStack stack, TooltipContext context, TooltipDisplay display, Consumer<Component> tooltip, TooltipFlag flag) {
		tooltip.accept(Component.translatable("item.thunderforge.storm_hammer.tooltip.leap").withStyle(ChatFormatting.AQUA));
		tooltip.accept(Component.translatable("item.thunderforge.storm_hammer.tooltip.dive").withStyle(ChatFormatting.DARK_AQUA));
		tooltip.accept(Component.translatable("item.thunderforge.storm_hammer.tooltip.chain").withStyle(ChatFormatting.YELLOW));
		tooltip.accept(Component.translatable("item.thunderforge.storm_hammer.tooltip.storm").withStyle(ChatFormatting.GOLD));
	}
}
