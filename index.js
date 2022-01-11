#!/usr/bin/env node

import process from 'process';
import fs from 'fs';
import path from 'path';
import DirectivePreprocessor from './source/DirectivePreprocessor.js';
import { Command } from 'commander'

const defaultMatrix = {};
const preprocessSource = (source, options) => {
  const preprocessor = new DirectivePreprocessor();
  const result = preprocessor.preprocess(source, options);
  if (options.outputPath) {
    const outputDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(options.outputPath, result);
  } else {
    process.stdout.write(result);
  }
};

const preprocessFile = (filePath, options) => {
  const source = fs.readFileSync(filePath, 'utf8');
  preprocessSource(source, options);
};

const replaceVariables = (value, variables) => {
  if (!value) {
    return value;
  }

  return value.replaceAll(/\$\(([\w]+)\)/g, (match, paramName) => {
    const paramValue = variables[paramName];
    if (!paramValue) {
      throw new Error(`Parameter ${paramName} is not defined`);
    }

    return paramValue;
  });
};

const processConfigurationTargets = (config, matrix, preprocessFunc) => {
  // Global data
  const globalVariables = config.variables || {};
  const globalIncludeSymbols = config.includeSymbols || {};
  const globalDefinedSymbols = config.definedSymbols || [];
  const globalFiles = config.files || [];

  // Matrix data
  const matrixVariables = matrix.variables || {};
  const matrixIncludeSymbols = matrix.includeSymbols || {};
  const matrixDefinedSymbols = matrix.definedSymbols || [];
  const matrixFiles = matrix.files || [];

  const variables = { ...globalVariables, ...matrixVariables };
  for (let target of config.targets) {
    const files = [...globalFiles, ...matrixFiles, ...(target.files || [])]
    if (!files.length) {
      throw new Error(`At least one file must be defined for target: ${target.name || JSON.stringify(target)}`);
    }

    const targetVariables = target.variables ? { ...variables, ...target.variables } : variables;
    const targetOutFileExtension = target.outFileExtension || matrix.outFileExtension || config.outFileExtension;
    const targetOutFolder = target.outFolder || matrix.outFolder || config.outFolder;
    const targetPreserveDirectives = target.preserveDirectives != null ? target.preserveDirectives
      : matrix.preserveDirectives != null ? matrix.preserveDirectives
      : config.preserveDirectives;
    targetVariables['__MATRIX_NAME'] = matrix.name || '';
    targetVariables['__TARGET_NAME'] = target.name || '';
    for (let file of files) {
      const fileName = path.basename(file);
      const extension = path.extname(fileName);
      let outExtension = replaceVariables(targetOutFileExtension || extension, targetVariables);
      if (outExtension[0] !== '.') {
        outExtension = `.${outExtension}`;
      }

      let outFolder = replaceVariables(targetOutFolder, targetVariables);
      outFolder = path.isAbsolute(outFolder) ? outFolder : path.resolve(outFolder);
      const fileOptions = {
        definedSymbols: [...globalDefinedSymbols, ...matrixDefinedSymbols, ...(target.definedSymbols || [])],
        includeSymbols: {...globalIncludeSymbols, ...matrixIncludeSymbols, ...(target.includeSymbols || {})},
        preserveDirectives: targetPreserveDirectives,
        outputPath: outFolder
          ? path.resolve(`${outFolder}/${fileName.substring(0, fileName.lastIndexOf(extension))}${outExtension}`)
          : null
      };

      preprocessFunc(file, fileOptions, target, matrix);
    }
  }
}

const processConfigurationFile = (configurationPath, preprocessFunc) => {
  const config = JSON.parse(fs.readFileSync(configurationPath, 'utf8'));
  const baseDirectory = path.dirname(fs.realpathSync(configurationPath));
  process.chdir(baseDirectory);
  if (!config.targets || !config.targets.length) {
    throw new Error("At least one target must be defined");
  }

  if (config.matrix && config.matrix.length) {
    for (let matrix of config.matrix) {
      processConfigurationTargets(config, matrix, preprocessFunc);
    }
  } else {
    processConfigurationTargets(config, defaultMatrix, preprocessFunc);
  }
};

const watchFile = (filePath, targetName, options) => {
  let timer;
  return fs.watch(filePath, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const label = `File ${filePath} was changed, preprocessing for ${targetName} completed`;
      console.time(label);
      preprocessFile(filePath, options);
      console.timeEnd(label);
    }, 100);
  });
};

let stdin = '';

const program = new Command()
  .version('1.1.0', '-v, --version', 'output the current version');

program
  .command('init')
  .description('creates a default configuration file')
  .action(() => {
    const content =
`{
  "files": ["Source.mc"],
  "targets": [
    {
      "name": "Debug",
      "definedSymbols": ["DEBUG"],
      "outFolder": "source-debug"
    },
    {
      "name": "Release",
      "definedSymbols": ["RELEASE"],
      "outFolder": "source-release"
    }
  ]
}`;
    fs.writeFileSync("./preprocess.config.json", content);
  });

program
  .command('preprocess')
  .description('preprocess directives for a file, configuration file or standard input')
  .argument('[filePath]', 'path to file to preprocess')
  .option('-d, --preserveDirectives', 'preserve directives in the preprocessed file')
  .option('-s, --definedSymbols [names...]', 'defined symbols separated by space (e.g. -s DEBUG TEST)')
  .option('-i, --includeSymbols [nameValues...]', 'include symbols (name=value) separated by space (e.g. -i A=123 B=ABC)')
  .option('-c, --configurationPath [path]', 'path to the configuration file')
  .option('-o, --outputPath [filePath]', 'output path for the preprocessed file')
  .option('-b, --baseDirectory [path]', 'base directory path that will be used to resolving relative paths for include directive. If not specified, the base directory will be the folder where the file to preprocess is located')
  .action((filePath, options) => {
    if (filePath) {
      preprocessFile(filePath, options);
    } else if (options.configurationPath) {
      processConfigurationFile(options.configurationPath, (file, fileOptions) => preprocessFile(file, fileOptions));
    } else if (stdin) {
      preprocessSource(stdin, options);
    } else {
      throw new Error(`filePath argument is required`);
    }
  });

program
  .command('watch')
  .description('watches files and preprocess them after they are changed.')
  .argument('<configurationPath>', 'path to the configuration file')
  .option('-p, --preprocessOnStart', 'preprocess all files defined in targets upon start')
  .action((configurationPath, options) => {
    const label = `Watching file ${configurationPath} started`;
    console.time(label);
    const fileWatchers = [];
    const processFile = (file, fileOptions, target, matrix) => {
      if (options.preprocessOnStart) {
        preprocessFile(file, fileOptions);
      }

      const targetName = matrix === defaultMatrix
        ? `target ${target.name}`
        : `matrix ${matrix.name} and target ${target.name}`;
      fileWatchers.push(watchFile(file, targetName, fileOptions));
    }

    processConfigurationFile(configurationPath, processFile);

    // In case the configuration fail was changed, process it again
    let timer;
    fs.watch(configurationPath, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const confLabel = `Configuration file ${configurationPath} changed`;
        console.time(confLabel);
        for(let fileWatcher of fileWatchers) {
          fileWatcher.close();
        }
  
        fileWatchers.length = 0;
        processConfigurationFile(configurationPath, processFile);
        console.timeEnd(confLabel);
      }, 100);
    });
    console.timeEnd(label);
  });

if (process.stdin.isTTY) {
  program.parse(process.argv);
}
else {
  process.stdin.on('readable', function() {
      const chunk = this.read();
      if (chunk !== null) {
        stdin += chunk;
      }
  });
  process.stdin.on('end', function() {
    program.parse(process.argv); 
  });
}
