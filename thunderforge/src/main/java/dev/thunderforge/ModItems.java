package dev.thunderforge;

import net.minecraft.core.Registry;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Rarity;
import net.minecraft.world.item.ToolMaterial;

import net.fabricmc.fabric.api.creativetab.v1.CreativeModeTabEvents;

public final class ModItems {
	public static final ResourceKey<Item> STORM_HAMMER_KEY = ResourceKey.create(Registries.ITEM, Thunderforge.id("storm_hammer"));

	public static final Item STORM_HAMMER = Registry.register(BuiltInRegistries.ITEM, STORM_HAMMER_KEY, new StormHammerItem(
			new Item.Properties()
					.setId(STORM_HAMMER_KEY)
					.sword(ToolMaterial.NETHERITE, 6.0f, -3.1f)
					.rarity(Rarity.EPIC)
					.component(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true)
	));

	private ModItems() {
	}

	static void init() {
		CreativeModeTabEvents.modifyOutputEvent(CreativeModeTabs.COMBAT).register(output -> output.accept(STORM_HAMMER));
	}
}
