import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: process.env.VITE_API_URL || "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
	plugins: [
		devtools({
			consolePiping: {
				enabled: false,
			},
		}),
		tailwindcss(),
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		viteReact(),
	],
});

export default config;
