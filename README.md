# directive-preprocessor

A preprocessor that is able to preprocess basic directives and can be used for languages that do not have support for them.

# Features

- Supports directives in a single line and multiline comments  (e.g. `// #if A` and `/* #if A */`) 
- Has the ability to watch files and preprocess them after they are changed
- Supports expressions (e.g. `// #if TEST && !RELEASE`)

# How to install

1. Install [Node.js](https://nodejs.org/en/download/) (Minimum version: `15.9.0`)
2. Run command `npm -g install directive-preprocessor` for installing the preprocessor globally

# Directives

The preprocessor supports the following directives:

- `#if`
- `#elif`
- `#else`
- `#endif`
- `#include`

There are two ways on how to use them:

- With a single line comment `// #if DEBUG`
- With a multiline comment `/* #if DEBUG */`

Here is a simple example using single line comments:
```js
// #if DEBUG
console.log("debug");
// #endif
```
and the same example by using multiline comments:
```js
/* #if DEBUG */
console.log("debug");
/* #endif */
```

the key difference is that with multiline comments, it is possible to have multiple directives in the same line:

```/* #if DEBUG */ console.log(/* #include MESSAGE */); /* #endif */```

## #include

The include directive can include a file content or a symbol value (defined in `includeSymbols` option):

- File content: `// #include "path/to/file.mc"`
- Symbol value: `// #include SYMBOL_NAME`

# Command line

After installing the preprocessor, it will be available as a command line tool via `directive-preprocessor`, which has the following commands:

- [preprocess](#preprocess)
- [init](#init)
- [watch](#watch)

## preprocess

```
Usage: index preprocess [options] [filePath]

preprocess directives for a file, configuration file or standard input

Arguments:
  filePath                             path to file to preprocess

Options:
  -d, --preserveDirectives             preserve directives in the preprocessed file
  -s, --definedSymbols [names...]      defined symbols separated by space (e.g. -s DEBUG TEST)
  -i, --includeSymbols [nameValues...] include symbols (name=value) separated by space (e.g. -i A=123 B=ABC)
  -c, --configurationPath [path]       path to the configuration file
  -o, --outputPath [filePath]          output path for the preprocessed file
  -b, --baseDirectory [path]           base directory path that will be used to resolving relative paths for include directive. If not specified, the base directory will be the folder where the file to preprocess is located
  -h, --help                           display help for command
```

`preprocess` command can preprocess the source from:

- Standard input (e.g. `"/* #if TEST */ console.log("...") /* #endif */" | directive-preprocessor -s TEST`)
- File (e.g. `directive-preprocessor ./Source.mc -s TEST`)
- Configuration file (e.g. `directive-preprocessor -c ./preprocess.config.json`)

## init

```
Usage: index init [options]

creates a default configuration file

Options:
  -h, --help  display help for command
```

`init` command is a simple command for creating a basic [configuration file](#configuration-file) (`preprocess.config.json`), where it is possible to configure the preprocessing for multiple files and be used by `preprocess` and `watch` command.

## watch

```
Usage: index watch [options] <configurationPath>

watches files and preprocess them after they are changed.

Arguments:
  configurationPath        path to the configuration file

Options:
  -p, --preprocessOnStart  preprocess all files defined in targets upon start
  -h, --help               display help for command
```

`watch` command is used to monitor the files to preprocess in the [configuration file](#configuration-file) and trigger the `preprocess` command when one of the files is changed.

# Configuration file

The configuration file is useful for preprocessing multiple files for different targets (e.g. debug, release, etc..) and can be used by the `watch` command to preprocess them after every change.   Below is an example of a configuration file using all available options:

```json
{
  "preserveDirectives": false,
  "files": ["Source.mc"],
  "includeSymbols": {
    "TEST": "TEST"
  },
  "definedSymbols": ["dataField"],
  "outFolder": "source-$(__MATRIX_NAME)",
  "outFileExtension": "$(__TARGET_NAME).mc",
  "matrix": [
    {
      "name": "X86",
      "files": ["Source2.mc"],
      "definedSymbols": ["X86"],
      "outFolder": "source/$(__TARGET_NAME)/$(__MATRIX_NAME)",
      "outFileExtension": "$(__TARGET_NAME).mc",
      "preserveDirectives": true,
      "variables": {
        "VAR2": "VALUE2"
      }
    }
  ],
  "targets": [
    {
      "name": "Debug",
      "files": ["Source3.mc"],
      "definedSymbols": ["TEST"],
      "includeSymbols": {
        "NAME": "Debug"
      },
      "outFolder": "source-test",
      "variables": {
        "VAR1": "VALUE"
      }
    },
    {
      "name": "Release",
      "files": ["Source3.mc"],
      "definedSymbols": ["RELEASE"],
      "includeSymbols": {
        "NAME": "Release"
      },
      "outFolder": "source/$(__TARGET_NAME)/$(__MATRIX_NAME)",
      "outFileExtension": "$(__TARGET_NAME).mc",
      "preserveDirectives": false
    }
  ]
}
```

The configuration is structured into three levels:
- [global](#global)
- [matrix](#matrix)
- [targets](#targets)

## global

The global level (root node) can contain configuration options that will be applied to lower levels (matrix and targets):
```json
{
  "preserveDirectives": false,
  "files": ["Source.mc"],
  "includeSymbols": {
    "TEST": "TEST"
  },
  "definedSymbols": ["dataField"],
  "outFolder": "source-$(__MATRIX_NAME)",
  "outFileExtension": "$(__TARGET_NAME).mc",
  "variables": {
    "VAR1": "VALUE"
  },
  "matrix": [],
  "targets": []
}
```

## matrix

The matrix can be used to create combination between items defined in the `matrix` and `targets`. The following example:
```json
{
  "files": ["Source.mc"],
  "outFolder": "source/$(__TARGET_NAME)/$(__MATRIX_NAME)",
  "matrix": [
    {
      "name": "X86",
      "definedSymbols": ["X86"],
    },
    {
      "name": "X64",
      "definedSymbols": ["X64"],
    }
  ],
  "targets": [
    {
      "name": "Debug",
      "definedSymbols": ["DEBUG"],
    },
    {
      "name": "Release",
      "definedSymbols": ["RELEASE"],
    }
  ]
}
```
will create the following files:
- `source/Debug/X86/Source.mc` with defined symbols: `X86` and `DEBUG`
- `source/Release/X86/Source.mc` with defined symbols: `X86` and `RELEASE`
- `source/Debug/X64/Source.mc` with defined symbols: `X64` and `DEBUG`
- `source/Release/X64/Source.mc` with defined symbols: `X64` and `RELEASE`

# targets

Targets is used to define one or more targets (e.g. `DEBUG`, `RELEASE`, `X64`, ...), where every target could have a list of file paths to preprocess, list of defined symbols and a folder for placing the preprocessed files. The following is a minimal configuration that contains a single target:
```json
{
  "targets": [
    {
      "name": "Debug",
      "files": ["Source.mc"],
      "definedSymbols": ["DEBUG"],
      "outFolder": "source-debug",
    }
  ]
}
```

## Options

### preserveDirectives (Default: false)

Whether to preserve the directives when preprocessing files.

### files

The file paths to preprocess.

### definedSymbols

The symbols that will be defined when preprocesing files.

### includeSymbols

Symbols with values that can be included by using the `include` directive (e.g. `// #include TEST`) or checked by an `if` or `elif` directive (e.g. `// #if TEST == "value"`).

### outFolder

The output folder where the preprocessed files will be stored.

### outFileExtension (Default: the extension of the soruce file)

The extension (e.g. `.js`) that will be used for preprocessed files.

## variables

Variables can be used to parametrize the following options:
- `outFolder`
- `outFileExtension`

the syntax for including a variable is `$(VAR_NAME)`, where `VAR_NAME` is the name of the variable.
There are two global variables that are always available:
- `__MATRIX_NAME`, which contains the current matrix name
- `__TARGET_NAME`, which contains the current target name

## Options merging

The following options can be placed on all three levels (global, matrix and targets) in the configuration file:

- preserveDirectives
- files
- definedSymbols
- includeSymbols
- outFolder
- outFileExtension
- variables

In case the above options are located on multiple levels the values will be merged by the following rules:
- In case the option value is an array (e.g. `"files": ["Source3.mc"]`), it will be merged by concatenating values of all arrays into one
- In case the option value is an object (e.g. `"includeSymbols": { "NAME": "Debug" }`), it will be merged by keys and in case of collisions,
keys defined in a target will override matrix and global keys, matrix keys will override global keys.
- In case the option value is a value type (e.g. `"preserveDirectives": false`), the first defined value from bottom level (targets) to top (global) will be used





