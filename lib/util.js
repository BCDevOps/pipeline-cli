//
// pipeline-cli
//
// Copyright © 2019 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

'use strict';

const crypto = require('crypto');
const isString = require('lodash.isstring');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const debug = require('debug');

const nameRegexPattern = '^(?:([^/]+?)/)?(([^/]+?)/(.*?))$';

const logger = {
  info: debug('info:OpenShiftClient'),
  trace: debug('trace:OpenShiftClient'),
};

const hashString = (itemAsString) => {
  const shasum = crypto.createHash('sha1');
  // var itemAsString = JSON.stringify(resource)
  shasum.update(`blob ${itemAsString.length + 1}\0${itemAsString}\n`);

  return shasum.digest('hex');
};

const hashObject = (resource) => {
  // var shasum = crypto.createHash('sha1');
  const itemAsString = JSON.stringify(resource);
  // shasum.update(`blob ${itemAsString.length + 1}\0${itemAsString}\n`);
  return hashString(itemAsString);
};

const isUrl = (string) => {
  const protocolAndDomainRE = /^(?:\w+)+:\/\/(\S+)$/;
  if (!isString(string)) return false;
  const match = string.match(protocolAndDomainRE);
  return match;
};

// const fullName = (resource) => `${resource.kind}/${resource.metadata.name}`;

const getBuildConfigInputImages = (bc) => {
  const result = [];
  const buildStrategy = bc.spec.strategy.sourceStrategy || bc.spec.strategy.dockerStrategy;

  if (buildStrategy.from) {
    result.push(buildStrategy.from);
  }

  if ((bc.spec.source || {}).images) {
    const sourceImages = bc.spec.source.images;
    sourceImages.forEach((sourceImage) => {
      result.push(sourceImage);
    });
  }

  return result;
};

const normalizeKind = (kind) => {
  if (kind === 'ImageStream') {
    return 'imagestream.image.openshift.io';
  }
  if (kind === 'BuildConfig') {
    return 'buildconfig.build.openshift.io';
  }
  return kind;
};

/* eslint no-underscore-dangle: 0 */
const _hashDirectory = (dir) => {
  const result = [];
  const items = fs.readdirSync(dir).sort();

  items.forEach((item) => {
    const fullpath = path.join(dir, item);
    const stat = fs.statSync(fullpath);
    if (stat.isDirectory()) {
      result.push(..._hashDirectory(fullpath));
    } else {
      result.push(hashString(fs.readFileSync(fullpath)));
    }
  });
  return result;
};

const hashDirectory = (dir) => {
  const items = _hashDirectory(dir);
  return hashObject(items);
};

const getBuildConfigStrategy = (bc) =>
  bc.spec.strategy.sourceStrategy || bc.spec.strategy.dockerStrategy;

function unsafeExecSync () {
  const ret=spawnSync.apply(null, arguments)
  logger.trace([arguments[0]].concat(arguments[1]).join(' '), ' - ', arguments[2], ' > ',ret.status)
  return ret
}

// --------------------------------
// parseName: (name, defaultNamespace) => {
//   var result = new RegExp(nameRegexPattern, 'g').exec(name)
//   return {
//     namespace:result[1] || defaultNamespace,
//     kind:result[3],
//     name:result[4]
//   }
// },
// name: (resource) => {
//   if (resource.kind && resource.name) return normalizeKind(resource.kind) + '/' + resource.name
//   return normalizeKind(resource.kind) + '/' + resource.metadata.name
// },
// fullName: (resource) => {
//   if (resource.namespace && resource.kind && resource.name) return resource.namespace + '/' + normalizeKind(resource.kind) + '/' + resource.name
//   return resource.metadata.namespace + '/' + normalizeKind(resource.kind) + '/' + resource.metadata.name
// },
// normalizeKind: normalizeKind,
// normalizeName: (name)=>{
//   if (name.startsWith('ImageStream/')){
//     return 'imagestream.image.openshift.io/'+name.substr('ImageStream/'.length)
//   }else if (name.startsWith('BuildConfig/')){
//     return 'buildconfig.build.openshift.io/'+name.substr('BuildConfig/'.length)
//   }
//   return name
// },
// getBuildConfigInputImages: getBuildConfigInputImages,
// getBuildConfigStrategy: getBuildConfigStrategy,
// hashDirectory:hashDirectory,
// getBuildConfigInputImages: (bc) => {
//   var result = []
//   var buildStrategy = getBuildConfigStrategy(bc)

//   if (buildStrategy.from){
//     result.push(buildStrategy.from)
//   }

//   if ((bc.spec.source || {}).images){
//     var sourceImages= bc.spec.source.images
//     sourceImages.forEach( sourceImage  => {
//         result.push(sourceImage.from)
//     })
//   }

//   return result
// },
// parseArguments: () => {
//   var options = {}
//   var argv=process.argv.slice(2)
//   argv.forEach(function(value){
//     if (value.startsWith('--')){
//       value=value.substr(2)
//       const sep= value.indexOf('=')
//       const argName=value.substring(0, sep)
//       const argValue=value.substring(sep+1)
//       options[argName]=argValue
//     }
//   })
//   return options
// },
// execSync:function() {
//   const ret = unsafeExecSync.apply(null, arguments)
//   if (ret.status !== 0){
//     throw new Error(`Failed running '${arguments[0]} ${arguments[1].join(" ")}' as it returned ${ret.status}`)
//   }
//   return ret
// },
// -----------------------

module.exports = {
  hashString:hashString,
  hashObject:hashObject,
  isUrl:isUrl,
  isString: isString,
  //TODO: shortName: (resource) => { return resource.metadata.name },
  parseName: (name, defaultNamespace) => {
    var result = new RegExp(nameRegexPattern, 'g').exec(name)
    return {
      namespace:result[1] || defaultNamespace,
      kind:result[3],
      name:result[4]
    }
  },
  name: (resource) => {
    if (resource.kind && resource.name) return normalizeKind(resource.kind) + '/' + resource.name
    return normalizeKind(resource.kind) + '/' + resource.metadata.name
  },
  fullName: (resource) => {
    if (resource.namespace && resource.kind && resource.name) return resource.namespace + '/' + normalizeKind(resource.kind) + '/' + resource.name
    return resource.metadata.namespace + '/' + normalizeKind(resource.kind) + '/' + resource.metadata.name
  },
  normalizeKind: normalizeKind,
  normalizeName: (name)=>{
    if (name.startsWith('ImageStream/')){
      return 'imagestream.image.openshift.io/'+name.substr('ImageStream/'.length)
    }else if (name.startsWith('BuildConfig/')){
      return 'buildconfig.build.openshift.io/'+name.substr('BuildConfig/'.length)
    }
    return name
  },
  getBuildConfigInputImages: getBuildConfigInputImages,
  getBuildConfigStrategy: getBuildConfigStrategy,
  hashDirectory:hashDirectory,
  getBuildConfigInputImages: (bc) => {
    var result = []
    var buildStrategy = getBuildConfigStrategy(bc)
  
    if (buildStrategy.from){
      result.push(buildStrategy.from)
    }
  
    if ((bc.spec.source || {}).images){
      var sourceImages= bc.spec.source.images
      sourceImages.forEach( sourceImage  => {
          result.push(sourceImage.from)
      })
    }

    return result
  },
  parseArguments: () => {
    var options = {}
    var argv=process.argv.slice(2)
    argv.forEach(function(value){
      if (value.startsWith('--')){
        value=value.substr(2)
        const sep= value.indexOf('=')
        const argName=value.substring(0, sep)
        const argValue=value.substring(sep+1)
        options[argName]=argValue
      }
    })
    return options
  },
  execSync:function() {
    const ret = unsafeExecSync.apply(null, arguments)
    if (ret.status !== 0){
      throw new Error(`Failed running '${arguments[0]} ${arguments[1].join(" ")}' as it returned ${ret.status}`)
    }
    return ret
  },
  unsafeExecSync: unsafeExecSync
}