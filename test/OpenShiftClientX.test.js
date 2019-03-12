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

const expect = require('expect');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const util = require('../lib/util');
const lib = require('./lib.test');
const OpenShiftClientX = require('../lib/OpenShiftClientX');
const OpenShiftResourceSelector = require('../lib/OpenShiftResourceSelector');

const useCase0BuildTemplate = require('./resources/bc.template.json');

const sandbox = sinon.createSandbox();

const PROJECT_TOOLS = 'csnr-devops-lab-tools';
const BASEDIR = path.resolve(__dirname, '..');

// eslint-disable-next-line func-names,space-before-function-paren
describe('OpenShiftClientX', function() {
  this.timeout(999999);
  const oc = new OpenShiftClientX({ namespace: PROJECT_TOOLS });

  // eslint-disable-next-line func-names,space-before-function-paren,prefer-arrow-callback
  afterEach(function() {
    // completely restore all fakes created through the sandbox
    sandbox.restore();
  });

  // eslint-disable-next-line func-names,space-before-function-paren,prefer-arrow-callback
  it('misc - @fast', async function() {
    const resource = { metadata: { annotations: { test: '123' } } };
    const resource1 = Object.assign({}, resource);

    oc.setAnnotation(resource1, 'test2', '456');
    expect(resource1).toEqual({ metadata: { annotations: { test: '123', test2: '456' } } });

    const getAnnotation = oc.getAnnotation(resource1, 'test');
    expect(getAnnotation).toEqual('123');

    const setLabel1 = oc.setLabel({ metadata: { annotations: { test: '123' } } }, 'test', '123');
    expect(setLabel1.metadata.labels).toEqual({ test: '123' });
  });

  // eslint-disable-next-line func-names,space-before-function-paren,prefer-arrow-callback
  it('startBuild - @fast', async function() {
    var params={NAME:'my-test-app'}

    var stub_action = sandbox.stub(oc, '_action')
    var stubExecSync = sandbox.stub(util, 'execSync')

    // eslint-disable-next-line func-names,space-before-function-paren,prefer-arrow-callback
    stubExecSync.callsFake(function fakeFn(...args) {
      throw new Error(`Not Implemented: ${JSON.stringify(args)}`);
    });

    var filePath = `${__dirname}/resources/bc.template.json`
    var processResult= lib.process(filePath, {param:params});

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'process', '-f', `${__dirname}/resources/bc.template-core.json`, '--param=NAME=my-test-app', '--output=json']
    ).returns({status:0, stdout:JSON.stringify({kind:'List', items:[{kind:'ImageStream', metadata:{name:params.NAME}}, {kind:'BuildConfig', metadata:{name:params.NAME}}]})})

    stub_action.callsFake(function fakeFn(...args) {
      throw new Error(`Not Implemented: ${JSON.stringify(args)}`)
    });

    expect(processResult).toBeInstanceOf(Array)
    expect(processResult).toHaveLength(4)
    expect(oc.toNamesList(processResult)).toEqual([`imagestream.image.openshift.io/${params.NAME}`, `imagestream.image.openshift.io/${params.NAME}-core`, `buildconfig.build.openshift.io/${params.NAME}-core`, `buildconfig.build.openshift.io/${params.NAME}`])

    oc.applyBestPractices(oc.wrapOpenShiftList(processResult))
    //TODO: needs to assert/verify result

    oc.applyRecommendedLabels(processResult, params.NAME, 'dev', '1')
    //TODO: needs to assert/verify result

    oc.fetchSecretsAndConfigMaps(processResult)
    //TODO: needs to assert/verify result

    
    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'apply', '-f', '-', '--output=name'], JSON.stringify(oc.wrapOpenShiftList(processResult))
    ).returns({status:0, stdout:`imagestream.image.openshift.io/${params.NAME}-core\nimagestream.image.openshift.io/${params.NAME}\nbuildconfig.build.openshift.io/${params.NAME}-core\nbuildconfig.build.openshift.io/${params.NAME}`})


    var filterByFullName= (fullNames)=>{
      var subset = processResult.filter((item)=>{
        var fullName = util.fullName(item)
        return fullNames.includes(fullName)
      })
      return subset
    }
    var subset1 = filterByFullName(['csnr-devops-lab-tools/buildconfig.build.openshift.io/my-test-app-core', 'csnr-devops-lab-tools/buildconfig.build.openshift.io/my-test-app'])
    

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'get', 'buildconfig.build.openshift.io/my-test-app-core', 'buildconfig.build.openshift.io/my-test-app', '--output=json']
    ).returns({status:0, stdout:JSON.stringify(oc.wrapOpenShiftList(subset1))})

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'get', 'imagestream.image.openshift.io/my-test-app-core', '--output=json']
    ).returns({status:0, stdout:JSON.stringify(oc.wrapOpenShiftList(filterByFullName(['csnr-devops-lab-tools/imagestream.image.openshift.io/my-test-app-core'])))})

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'get', 'imagestream.image.openshift.io/my-test-app', '--output=json']
    ).returns({status:0, stdout:JSON.stringify(oc.wrapOpenShiftList(filterByFullName(['csnr-devops-lab-tools/imagestream.image.openshift.io/my-test-app'])))})

    stub_action.withArgs(
      ['--namespace=openshift', 'get', 'imagestream.image.openshift.io/python', '--output=json']
    ).returns({status:0, stdout:fs.readFileSync(`${__dirname}/resources/oc-607be20fff1241a2cd34534dfcadf0add63db2f9.cache.json`, {encoding:'utf-8'})})
    
    stub_action.withArgs(
      ['--namespace=openshift', 'get', 'ImageStreamTag/python:2.7', '--output=jsonpath={.image.metadata.name}']
    ).returns({status:0, stdout:fs.readFileSync(`${__dirname}/resources/oc-0c27ba108b45b02184fb3c2d9f17c15e1ebe5eb0.cache.txt`, {encoding:'utf-8'})})
    
    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'set', 'env', 'buildconfig.build.openshift.io/my-test-app-core', '--env=_BUILD_HASH=5c797a4d69cd9bebfb03c0fcf8cac94c68648c4b', '--overwrite=true']
    ).returns({status:0, stdout:'not-used'})

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'set', 'env', 'buildconfig.build.openshift.io/my-test-app', '--env=_BUILD_HASH=bb6a1a5882cc91915f31c620482bacb8070deb3f', '--overwrite=true']
    ).returns({status:0, stdout:'not-used'})

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'start-build', 'buildconfig.build.openshift.io/my-test-app-core', '--wait=true', '--output=name']
    ).returns({status:0, stdout:'Build/my-test-app-core-1'})

    const build1={
      kind:'Build',
      metadata:{
        name: 'my-test-app-core-1',
        namespace: 'csnr-devops-lab-tools'
      },
      status:{
        phase: 'Complete'
      }
    }

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'get', 'Build/my-test-app-core-1', '--output=json']
    ).returns({status:0, stdout:JSON.stringify(build1)})

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'start-build', 'buildconfig.build.openshift.io/my-test-app', '--wait=true', '--output=name']
    ).returns({status:0, stdout:'Build/my-test-app-1'})

    const build2={
      kind:'Build',
      metadata:{
        name: 'my-test-app-1',
        namespace: 'csnr-devops-lab-tools'
      },
      status:{
        phase: 'Complete'
      }
    }

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'get', 'Build/my-test-app-1', '--output=json']
    ).returns({status:0, stdout:JSON.stringify(build2)})

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'get', 'ImageStreamTag/my-test-app-core:latest', '--output=jsonpath={.image.metadata.name}']
    ).returns({status:0, stdout:fs.readFileSync(`${__dirname}/resources/oc-a1d829dffc04a39da661796a53dc512a6ead6033.cache.json`, {encoding:'utf-8'})})

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'set', 'env', 'buildconfig.build.openshift.io/my-test-app-core', '--env=_BUILD_HASH=4f9cc34cf9a4194b2f08f11a3cb995d79553a767', '--overwrite=true']
    ).returns({status:0, stdout: '' })

    stub_action.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'set', 'env', 'buildconfig.build.openshift.io/my-test-app', '--env=_BUILD_HASH=04b941ded32c1b82c93b089d5c4bb6f227ea3786', '--overwrite=true']
    ).returns({status:0, stdout: '' })

    stubExecSync.withArgs('git', ['rev-parse', 'HEAD:app-base'], {cwd: BASEDIR, encoding: 'utf-8'}).returns({status:0, stdout:'123456'});
    stubExecSync.withArgs('git', ['rev-parse', 'HEAD:app'], {cwd: BASEDIR, encoding: 'utf-8'}).returns({status:0, stdout:'123456'});
    //stubExecSync.onCall(0).returns({status:0, stdout:'123456'})

    var applyResult = oc.apply(processResult)
    expect(applyResult).toBeInstanceOf(OpenShiftResourceSelector)
    expect(applyResult.names()).toEqual([`imagestream.image.openshift.io/${params.NAME}-core`, `imagestream.image.openshift.io/${params.NAME}`, `buildconfig.build.openshift.io/${params.NAME}-core`, `buildconfig.build.openshift.io/${params.NAME}`])    
    var bc = applyResult.narrow('bc')
    expect(bc.names()).toEqual([`buildconfig.build.openshift.io/${params.NAME}-core`, `buildconfig.build.openshift.io/${params.NAME}`])    

    await bc.startBuild({wait:'true'})

  }); // end it

  // eslint-disable-next-line func-names,space-before-function-paren,prefer-arrow-callback
  it('build - @this', async function() {
    const params = { NAME: 'my-test-app' };
    const stubAction = sandbox.stub(oc, '_action');
    const stubExecSync = sandbox.stub(util, 'execSync');

    // eslint-disable-next-line func-names,space-before-function-paren,prefer-arrow-callback
    stubAction.callsFake(function fakeFn(...args) {
      throw new Error(`Not Implemented: ${JSON.stringify(args)}`);
    });

    // eslint-disable-next-line func-names,space-before-function-paren,prefer-arrow-callback
    stubExecSync.callsFake(function fakeFn(...args) {
      throw new Error(`Not Implemented: ${JSON.stringify(args)}`);
    });

    const objects = [];
    const filePath = `${__dirname}/resources/bc.template.json`;

    const process = (item, template, parameters) => {
      Object.keys(item).forEach((key) => {
        let value = item[key];
        if (util.isString(value)) {
          value = value.replace('', '');
          template.parameters.forEach((param) => {
            const regex = new RegExp(`\\$\{${param.name}}`, 'gm');
            value = value.replace(regex, parameters[param.name] || param.value || '');
          });
          // eslint-disable-next-line no-param-reassign
          item[key] = value;
        } else if (util.isArray(value)) {
          value.forEach((subItem) => {
            process(subItem, template, parameters);
          });
        } else if (util.isPlainObject(value)) {
          process(value, template, parameters);
        }
      });
      return item;
    };

    const processTemplate = (template, parameters) => {
      const processed = process(template, template, parameters);
      return oc.wrapOpenShiftList(processed.objects);
    };

    const processedTemplate = processTemplate(useCase0BuildTemplate, params);
    // eslint-disable-next-line prettier/prettier
    stubAction.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'process', '-f', `${BASEDIR}/test/resources/bc.template.json`, `--param=NAME=${params.NAME}`, '--output=json'] // eslint-disable-line prettier/prettier,max-len
    ).returns({ status: 0, stdout: JSON.stringify(processedTemplate) }); // eslint-disable-line prettier/prettier,max-len

    // eslint-disable-next-line prettier/prettier
    stubExecSync.withArgs(
      'git', ['clean', '-fd'], { cwd: '/tmp/fc2dcf724ddb37bc0851a853b8a35eee7c0956ee' } // eslint-disable-line prettier/prettier,max-len
    ).returns({ status: 0 }); // eslint-disable-line prettier/prettier,max-len

    // eslint-disable-next-line prettier/prettier
    stubExecSync.withArgs(
      'git', ['fetch', '--depth', '1', '--no-tags', '--update-shallow', 'origin', 'WIP'], { cwd: '/tmp/fc2dcf724ddb37bc0851a853b8a35eee7c0956ee' } // eslint-disable-line prettier/prettier,max-len
    ).returns({ status: 0 }); // eslint-disable-line prettier/prettier,max-len

    // eslint-disable-next-line prettier/prettier
    stubExecSync.withArgs(
      'git', ['checkout', 'WIP'], { cwd: '/tmp/fc2dcf724ddb37bc0851a853b8a35eee7c0956ee' } // eslint-disable-line prettier/prettier,max-len
    ).returns({ status: 0 }); // eslint-disable-line prettier/prettier,max-len

    // eslint-disable-next-line prettier/prettier
    stubExecSync.withArgs(
      'git', ['rev-parse', 'WIP:app-base'], { cwd: '/tmp/fc2dcf724ddb37bc0851a853b8a35eee7c0956ee', encoding: 'utf-8' } // eslint-disable-line prettier/prettier,max-len
    ).returns({ status: 0, stdout: '123456' }); // eslint-disable-line prettier/prettier,max-len

    // eslint-disable-next-line prettier/prettier
    stubExecSync.withArgs(
      'git', ['rev-parse', 'WIP:app'], { cwd: '/tmp/fc2dcf724ddb37bc0851a853b8a35eee7c0956ee', encoding: 'utf-8' } // eslint-disable-line prettier/prettier,max-len
    ).returns({ status: 0, stdout: '123456' }); // eslint-disable-line prettier/prettier,max-len

    objects.push(...oc.processBuidTemplate(oc.toFileUrl(filePath), { param: params }));
    expect(objects).toHaveLength(4);
    const phase = { name: params.NAME, changeId: 0, instance: `${params.NAME}-0` };
    oc.applyRecommendedLabels(objects, phase.name, 'build', phase.changeId, phase.instance);
    const recommendedLabels = {};
    oc.copyRecommendedLabels(objects[0].metadata.labels, recommendedLabels);
    expect(recommendedLabels).toEqual({
      app: 'my-test-app-0',
      'app-name': 'my-test-app',
      'env-id': 0,
      'env-name': 'build',
      'github-owner': 'bcdevops',
      'github-repo': 'pipeline-cli',
    });
    // eslint-disable-next-line prettier/prettier
    stubAction.withArgs(
      ['--namespace=csnr-devops-lab-tools', 'apply', '-f', '-', '--output=name'], JSON.stringify(oc.wrapOpenShiftList(objects)) // eslint-disable-line prettier/prettier,max-len
    ).returns({ status: 0, stdout: 'abc\n123' }); // eslint-disable-line prettier/prettier,max-len

    oc.applyAndBuild(objects);
  });
}); // end describe
