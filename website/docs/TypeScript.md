---
id: typescript
title: TypeScript Setup
---

You can write tests using [TypeScript](http://www.typescriptlang.org) to get autocompletion and type safety.

You will need [`typescript`](https://github.com/microsoft/TypeScript) and [`ts-node`](https://github.com/TypeStrong/ts-node) installed as `devDependencies`. WebdriverIO will automatically detect if these dependencies are installed and will compile your config and tests for you. If you need to configure how ts-node runs please use the environment variables for [ts-node](TypeScript.md) or use wdio config's [autoCompileOpts section](ConfigurationFile.md).

```bash npm2yarn
$ npm install typescript ts-node --save-dev
```

The minimum TypeScript version is `v4.0.5`.

## Configuration

You can provide custom `ts-node` and `tsconfig-paths` options through your `wdio.conf.ts`, e.g.:

```ts title="wdio.conf.ts"
export const config = {
    // ...
    autoCompileOpts: {
        autoCompile: true,
        // see https://github.com/TypeStrong/ts-node#cli-and-programmatic-options
        // for all available options
        tsNodeOpts: {
            transpileOnly: true,
            project: 'tsconfig.json'
        },
        // tsconfig-paths is only used if "tsConfigPathsOpts" are provided, if you
        // do please make sure "tsconfig-paths" is installed as dependency
        tsConfigPathsOpts: {
            baseUrl: './'
        }
    }
}
```

If you don't want to use WebdriverIO's internal transpiler functionality you can create your own `entrypoint.js` file where `ts-node` is defined manually:

<!--DOCUSAURUS_CODE_TABS-->
<!--Using EcmaScript Modules-->
```js title="entrypoint.js"
import { register } from 'ts-node'
register({
    transpileOnly: false,
    files: true,
    project: "./tsconfig.json"
})
export * from './configs/wdio.conf'
```
<!--Using CommonJS-->
```js title="entrypoint.js"
require('ts-node').register(
    {
        transpileOnly: false,
        files: true,
        project: "./tsconfig.json"
    }
)
module.exports = require('./configs/wdio.conf')
```
<!--END_DOCUSAURUS_CODE_TABS-->

In this case you have to pass `--no-autoCompileOpts.autoCompile` as parameter to the `wdio` command to disable auto compiling, e.g.:

```sh
npx wdio run ./entrypoint.js --no-autoCompileOpts.autoCompile
```

## Framework Setup

And your `tsconfig.json` needs the following:

```json title="tsconfig.json"
{
    "compilerOptions": {
        "types": ["node", "@wdio/globals/types"]
    }
}
```

Please avoid importing `webdriverio` or `@wdio/sync` explicitly.
`WebdriverIO` and `WebDriver` types are accessible from anywhere once added to `types` in `tsconfig.json`. If you use additional WebdriverIO services, plugins or the `devtools` automation package, please also add them to the `types` list as many provide additional typings.

## Framework Types

Depending on the framework you use, you will need to add the types for that framework to your `tsconfig.json` types property, as well as install its type definitions. This is especially important if you want to have type support for the built-in assertion library [`expect-webdriverio`](https://www.npmjs.com/package/expect-webdriverio).

For instance, if you decide to use the Mocha framework, you need to install `@types/mocha` and add it like this to have all types globally available:

<Tabs
  defaultValue="mocha"
  values={[
    {label: 'Mocha', value: 'mocha'},
    {label: 'Jasmine', value: 'jasmine'},
    {label: 'Cucumber', value: 'cucumber'},
  ]
}>
<TabItem value="mocha">

```json title="tsconfig.json"
{
    "compilerOptions": {
        "types": ["node", "@wdio/globals/types", "@wdio/mocha-framework"]
    }
}
```

</TabItem>
<TabItem value="jasmine">

```json title="tsconfig.json"
{
    "compilerOptions": {
        "types": ["node", "@wdio/globals/types", "@wdio/jasmine-framework"]
    }
}
```

</TabItem>
<TabItem value="cucumber">

```json title="tsconfig.json"
{
    "compilerOptions": {
        "types": ["node", "@wdio/globals/types", "@wdio/cucumber-framework"]
    }
}
```

</TabItem>
</Tabs>

## Services

If you use services that add commands to the browser scope you also need to include these into your `tsconfig.json`. For example if you use the `@wdio/devtools-service` ensure that you add it to the `types` as well, e.g.:

```json title="tsconfig.json"
{
    "compilerOptions": {
        "types": [
            "node",
            "@wdio/globals/types",
            "@wdio/mocha-framework",
            "@wdio/devtools-service"
        ]
    }
}
```

Adding services and reporters to your TypeScript config also strengthen the type safety of your WebdriverIO config file.

## Type Definitions

When running WebdriverIO commands all properties are usually typed so that you don't have to deal with importing additional types. However there are cases where you want to define variables upfront. To ensure that these are type safe you can use all types defined in the [`@wdio/types`](https://www.npmjs.com/package/@wdio/types) package. For example if you like to define the remote option for `webdriverio` you can do:

```ts
import type { Capabilities } from '@wdio/types'

const config: Capabilities.WebdriverIO = {
    hostname: 'http://localhost',
    port: '4444' // Error: Type 'string' is not assignable to type 'number'.ts(2322)
    capabilities: {
        browserName: 'chrome'
    }
}
```

## Adding Custom Commands

With TypeScript, it's easy to extend WebdriverIO interfaces. Add types to your [custom commands](CustomCommands.md) like this:

1. Create a type definition file (e.g., `./src/types/wdio.d.ts`)
2. a. If using a module-style type definition file (using import/export and `declare global WebdriverIO` in the type definition file), make sure to include the file path in the `tsconfig.json` `include` property.

   b.  If using ambient-style type definition files (no import/export in type definition files and `declare namespace WebdriverIO` for custom commands), make sure the `tsconfig.json` does *not* contain any `include` section, since this will cause all type definition files not listed in the `include` section to not be recognized by typescript.

<Tabs
  defaultValue="modules"
  values={[
    {label: 'Modules (using import/export)', value: 'modules'},
    {label: 'Ambient Type Definitions (no tsconfig include)', value: 'ambient'},
  ]
}>
<TabItem value="modules">

```json title="tsconfig.json"
{
    "compilerOptions": { ... },
    "include": [
        "./test/**/*.ts",
        "./src/types/**/*.ts"
    ]
}
```

</TabItem>
<TabItem value="ambient">

```json title="tsconfig.json"
{
    "compilerOptions": { ... }
}
```

</TabItem>
</Tabs>

3. Add definitions for your commands according to your execution mode.

<Tabs
  defaultValue="modules"
  values={[
    {label: 'Modules (using import/export)', value: 'modules'},
    {label: 'Ambient Type Definitions', value: 'ambient'},
  ]
}>
<TabItem value="modules">

<Tabs
  defaultValue="async"
  values={[
    {label: 'Async', value: 'async'},
    {label: 'Sync', value: 'sync'},
  ]
}>
<TabItem value="sync">

```typescript
declare global {
    namespace WebdriverIO {
        interface Browser {
            browserCustomCommand: (arg: any) => void
        }

        interface MultiRemoteBrowser {
            browserCustomCommand: (arg: any) => void
        }

        interface Element {
            elementCustomCommand: (arg: any) => number
        }
    }
}
```

</TabItem>
<TabItem value="async">

```typescript
declare global {
    namespace WebdriverIO {
        interface Browser {
            browserCustomCommand: (arg: any) => Promise<void>
        }

        interface MultiRemoteBrowser {
            browserCustomCommand: (arg: any) => Promise<void>
        }

        interface Element {
            elementCustomCommand: (arg: any) => Promise<number>
        }
    }
}
```

</TabItem>
</Tabs>

</TabItem>
<TabItem value="ambient">

<Tabs
  defaultValue="async"
  values={[
    {label: 'Async', value: 'async'},
    {label: 'Sync', value: 'sync'},
  ]
}>
<TabItem value="sync">

```typescript
declare namespace WebdriverIO {
    interface Browser {
        browserCustomCommand: (arg: any) => void
    }

    interface MultiRemoteBrowser {
        browserCustomCommand: (arg: any) => void
    }

    interface Element {
        elementCustomCommand: (arg: any) => number
    }
}
```

</TabItem>
<TabItem value="async">

```typescript
declare namespace WebdriverIO {
    interface Browser {
        browserCustomCommand: (arg: any) => Promise<void>
    }

    interface MultiRemoteBrowser {
        browserCustomCommand: (arg: any) => Promise<void>
    }

    interface Element {
        elementCustomCommand: (arg: any) => Promise<number>
    }
}
```

</TabItem>
</Tabs>

</TabItem>
</Tabs>

## Tips and Hints

### tsconfig.json example
<Tabs
  defaultValue="modules"
  values={[
    {label: 'Modules (using import/export)', value: 'modules'},
    {label: 'Ambient Type Definitions (no tsconfig include)', value: 'ambient'},
  ]
}>
<TabItem value="modules">

```json
{
  "compilerOptions": {
    "outDir": "./.tsbuild/",
    "sourceMap": false,
    "target": "es2019",
    "module": "commonjs",
    "removeComments": true,
    "noImplicitAny": true,
    "strictPropertyInitialization": true,
    "strictNullChecks": true,
    "types": [
      "node",
      "@wdio/globals/types",
      "@wdio/mocha-framework"
    ]
  },
  "include": [
    "./test/**/*.ts",
    "./src/types/**/*.ts"
  ]
}
```

</TabItem>
<TabItem value="ambient">

```json
{
  "compilerOptions": {
    "outDir": "./.tsbuild/",
    "sourceMap": false,
    "target": "es2019",
    "module": "commonjs",
    "removeComments": true,
    "noImplicitAny": true,
    "strictPropertyInitialization": true,
    "strictNullChecks": true,
    "types": [
      "node",
      "@wdio/globals/types",
      "@wdio/mocha-framework"
    ]
  }
}
```

</TabItem>
</Tabs>

### Compile & Lint

To be entirely safe, you may consider following the best practices: compile your code with TypeScript compiler (run `tsc` or `npx tsc`) and have [eslint](https://www.npmjs.com/package/@typescript-eslint/eslint-plugin) running on [pre-commit hook](https://github.com/typicode/husky).
