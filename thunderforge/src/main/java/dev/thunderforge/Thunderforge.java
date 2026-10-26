package dev.thunderforge;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.minecraft.resources.Identifier;

import net.fabricmc.api.ModInitializer;

public class Thunderforge implements ModInitializer {
	public static final String MOD_ID = "thunderforge";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(MOD_ID, path);
	}

	@Override
	public void onInitialize() {
		ModItems.init();
		StormPowers.init();
		LOGGER.info("The forge is lit. Thunder answers to the hammer.");
	}
}
