# Archetype Alignment Items for Black Crusade Apex

A Foundry VTT module providing zero-XP alignment credits for characters using the Black Crusade Apex system.

## Requirements

- Foundry VTT v14
- Black Crusade Apex system (`black-crusade-apex`)
- GM access to initialize the compendium and apply credits

## Installation

Copy `apex-archetype-alignment-items` to your Foundry `Data/modules` directory and enable it in the world. On first load as GM, the module creates the **Apex BC — Archetype Alignment Credits** world compendium.

## Usage

The compendium contains +1 and +5 items for Khorne, Nurgle, Slaanesh, and Tzeentch. Drag an item onto a character to add the corresponding number of alignment credits. Removing the item removes only the credits associated with that item.

Credits are stored as zero-cost entries in `system.dh2e.advanceLog`. A +5 item also assigns the character's current alignment to bypass the sheets usual 10 Corruption threshold. A +1 item changes only the alignment tally. Removing a +5 item does not automatically restore the previous alignment.

The items do not grant talents or spend XP. Alignment credits may affect Mark of Chaos thresholds where the system derives them from advancement history.

The module creates a world compendium rather than bundling a database pack; its contents persist between module updates. Existing entries are retained on initialization.

## Notes

- Verify item behavior in a test world before applying credits to existing characters.
- This module has not been tested in a live Foundry v14 instance.
- No external libraries are required.
