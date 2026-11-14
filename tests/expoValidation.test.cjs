const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const cli=path.dirname(require.resolve('@expo/cli/package.json'));
const {PluginSchema,DevToolsPluginOutputSchema}=require(path.join(cli,'build/src/start/server/DevToolsPlugin.schema.js'));
const {createMCPDevToolsExtensionSchema}=require(path.join(cli,'build/src/start/server/createMCPDevToolsExtensionSchema.js'));
const plugin={packageName:'validation-fixture',packageRoot:'/tmp/validation-fixture',cliExtensions:{description:'Test commands',entryPoint:'command.cjs',commands:[{name:'inspect',title:'Inspect',environments:['cli','mcp'],parameters:[{name:'limit',type:'number'},{name:'confirm',type:'confirm'},{name:'filter',type:'text'}]}]}};
test('Expo plugin validation accepts supported inputs and rejects invalid descriptors and output',()=>{
 assert.equal(PluginSchema.safeParse(plugin).success,true);
 assert.equal(PluginSchema.safeParse({...plugin,packageName:''}).success,false);
 assert.equal(PluginSchema.safeParse({...plugin,cliExtensions:{...plugin.cliExtensions,commands:[]}}).success,false);
 assert.equal(DevToolsPluginOutputSchema.safeParse([{type:'text',text:'Ready',level:'info'},{type:'image',url:'https://example.com/image.png'}]).success,true);
 assert.equal(DevToolsPluginOutputSchema.safeParse([{type:'audio',url:'not-a-url'}]).success,false);
});
test('Expo command schema keeps strict command and parameter validation after the security update',()=>{
 const schema=createMCPDevToolsExtensionSchema(plugin);
 assert.equal(schema.safeParse({command:'inspect',limit:3,confirm:true,filter:'session'}).success,true);
 for(const invalid of [{command:'other'},{command:'inspect',limit:'3'},{command:'inspect',confirm:'true'},{command:'inspect',extra:'unexpected'}])assert.equal(schema.safeParse(invalid).success,false);
});
test('oversized constrained arrays fail before accumulating per-element validation errors',()=>{
 const {z}=require(require.resolve('zod',{paths:[cli]}));
 const result=z.array(z.string()).max(2).safeParse(Array(100000).fill(0));
 assert.equal(result.success,false);assert.equal(result.error.issues.length,1);assert.equal(result.error.issues[0].code,'too_big');
});
