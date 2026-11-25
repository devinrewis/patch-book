# Patch Notes — Hardware Synth Patchbook

A lightweight, client-side web app for creating **ARP 2600 manual–style** block-arrow patch diagrams for external hardware synthesizers and modular rigs.

## Features
- **ARP-Style Signal Flow**: Audio signals flow **left → right** (solid arrows), CV/modulation signals flow **bottom → top** (dashed arrows), with straight lines that snap parallel to the grid and editable output/input jack labels on each end.
- **Dynamic Auto-Resizing Modules**: Build custom modules with **knobs**, **sliders**, and **3-way switches** (with custom labels). Boxes grow and shrink automatically as you add or remove parameters, and any module can be saved to your reusable Module Library.
- **Infinite Canvas**: Pan, zoom, and drag modules freely in all directions with grid snapping.
- **Multiple Patchbooks & Page Flipping**: Organize sets into separate patchbooks, flip through pages with the top bar or `←`/`→` arrow keys, and switch to **Perform Mode** to lock the canvas for live use.
- **Dark & Light Themes**: Toggle between Stage Dark and classic ARP Manual Paper Light.
- **100% Local Persistence & URL Sharing**: Auto-saves to `localStorage` with zero backend. Export/import patchbooks as JSON, or click **Share** to generate a compressed URL that saves directly as a new patchbook on the recipient's device.

## Running Locally
Open `index.html` directly in any modern browser—no build step or server required.
