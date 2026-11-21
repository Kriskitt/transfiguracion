import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [{
    name: 'experiment-generator-adapter',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('?generator')) return null;
      return code.replace(/if \(typeof document !== 'undefined'\)[\s\S]*$/, '');
    },
  }],
});
