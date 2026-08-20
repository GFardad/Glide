export { ExamplePluginLoader } from "./loader.js";
/**
 * Example plugin entrypoint. The loader resolves this module and calls the
 * named export with the plugin descriptor, returning a PluginInstance.
 */
export function createExamplePlugin(descriptor) {
    const api = {
        describe() {
            return `${descriptor.name}@${descriptor.version} (${descriptor.kind})`;
        },
        run(input) {
            return { ok: true, output: `echo: ${input}` };
        },
    };
    return {
        descriptor,
        loadedAt: new Date(),
        state: { api },
    };
}
export default createExamplePlugin;
//# sourceMappingURL=index.js.map