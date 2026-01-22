// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";
var vite_config_default = defineConfig({
  base: "http://localhost:3004/",
  plugins: [
    react({
      jsxRuntime: "automatic"
    }),
    federation({
      name: "crm_app",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App.tsx"
      },
      shared: {
        react: { singleton: true, requiredVersion: "^19.2.0" },
        "react-dom": { singleton: true, requiredVersion: "^19.2.0" },
        "react-router-dom": { singleton: true, requiredVersion: "^7.12.0" },
        "framer-motion": { singleton: true },
        "lucide-react": { singleton: true },
        "@so360/shell-context": { singleton: true },
        "@so360/design-system": { singleton: true },
        "@so360/event-bus": { singleton: true }
      }
    })
  ],
  build: {
    target: "esnext",
    minify: false,
    cssCodeSplit: false
  },
  server: {
    port: 3004,
    cors: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCBmZWRlcmF0aW9uIGZyb20gJ0BvcmlnaW5qcy92aXRlLXBsdWdpbi1mZWRlcmF0aW9uJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgICBiYXNlOiAnaHR0cDovL2xvY2FsaG9zdDozMDA0LycsXG4gICAgcGx1Z2luczogW1xuICAgICAgICByZWFjdCh7XG4gICAgICAgICAgICBqc3hSdW50aW1lOiAnYXV0b21hdGljJyxcbiAgICAgICAgfSksXG4gICAgICAgIGZlZGVyYXRpb24oe1xuICAgICAgICAgICAgbmFtZTogJ2NybV9hcHAnLFxuICAgICAgICAgICAgZmlsZW5hbWU6ICdyZW1vdGVFbnRyeS5qcycsXG4gICAgICAgICAgICAvLyBBY2Nlc3MgZnJvbSBTaGVsbDogaW1wb3J0KCdjcm1fYXBwL0FwcCcpXG4gICAgICAgICAgICBleHBvc2VzOiB7XG4gICAgICAgICAgICAgICAgJy4vQXBwJzogJy4vc3JjL0FwcC50c3gnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNoYXJlZDoge1xuICAgICAgICAgICAgICAgIHJlYWN0OiB7IHNpbmdsZXRvbjogdHJ1ZSwgcmVxdWlyZWRWZXJzaW9uOiAnXjE5LjIuMCcgfSxcbiAgICAgICAgICAgICAgICAncmVhY3QtZG9tJzogeyBzaW5nbGV0b246IHRydWUsIHJlcXVpcmVkVmVyc2lvbjogJ14xOS4yLjAnIH0sXG4gICAgICAgICAgICAgICAgJ3JlYWN0LXJvdXRlci1kb20nOiB7IHNpbmdsZXRvbjogdHJ1ZSwgcmVxdWlyZWRWZXJzaW9uOiAnXjcuMTIuMCcgfSxcbiAgICAgICAgICAgICAgICAnZnJhbWVyLW1vdGlvbic6IHsgc2luZ2xldG9uOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgJ2x1Y2lkZS1yZWFjdCc6IHsgc2luZ2xldG9uOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgJ0BzbzM2MC9zaGVsbC1jb250ZXh0JzogeyBzaW5nbGV0b246IHRydWUgfSxcbiAgICAgICAgICAgICAgICAnQHNvMzYwL2Rlc2lnbi1zeXN0ZW0nOiB7IHNpbmdsZXRvbjogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICdAc28zNjAvZXZlbnQtYnVzJzogeyBzaW5nbGV0b246IHRydWUgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgIF0sXG4gICAgYnVpbGQ6IHtcbiAgICAgICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICAgICAgbWluaWZ5OiBmYWxzZSxcbiAgICAgICAgY3NzQ29kZVNwbGl0OiBmYWxzZSxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgICBwb3J0OiAzMDA0LFxuICAgICAgICBjb3JzOiB0cnVlLCAvLyBBbGxvdyBTaGVsbCB0byBsb2FkIHJlbW90ZUVudHJ5LmpzXG4gICAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixPQUFPLGdCQUFnQjtBQUV2QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixNQUFNO0FBQUEsRUFDTixTQUFTO0FBQUEsSUFDTCxNQUFNO0FBQUEsTUFDRixZQUFZO0FBQUEsSUFDaEIsQ0FBQztBQUFBLElBQ0QsV0FBVztBQUFBLE1BQ1AsTUFBTTtBQUFBLE1BQ04sVUFBVTtBQUFBLE1BRVYsU0FBUztBQUFBLFFBQ0wsU0FBUztBQUFBLE1BQ2I7QUFBQSxNQUNBLFFBQVE7QUFBQSxRQUNKLE9BQU8sRUFBRSxXQUFXLE1BQU0saUJBQWlCLFVBQVU7QUFBQSxRQUNyRCxhQUFhLEVBQUUsV0FBVyxNQUFNLGlCQUFpQixVQUFVO0FBQUEsUUFDM0Qsb0JBQW9CLEVBQUUsV0FBVyxNQUFNLGlCQUFpQixVQUFVO0FBQUEsUUFDbEUsaUJBQWlCLEVBQUUsV0FBVyxLQUFLO0FBQUEsUUFDbkMsZ0JBQWdCLEVBQUUsV0FBVyxLQUFLO0FBQUEsUUFDbEMsd0JBQXdCLEVBQUUsV0FBVyxLQUFLO0FBQUEsUUFDMUMsd0JBQXdCLEVBQUUsV0FBVyxLQUFLO0FBQUEsUUFDMUMsb0JBQW9CLEVBQUUsV0FBVyxLQUFLO0FBQUEsTUFDMUM7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDSCxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsSUFDUixjQUFjO0FBQUEsRUFDbEI7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNKLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNWO0FBQ0osQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
