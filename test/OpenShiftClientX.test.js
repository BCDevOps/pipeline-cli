'use strict';

const expect = require('expect');
const sinon = require('sinon');
const sandbox = sinon.createSandbox();
const util = require('../lib/util');
const lib = require('./lib.test');
const fs = require('fs');

const OpenShiftClientX = require('../lib/OpenShiftClientX');
const OpenShiftResourceSelector = require('../lib/OpenShiftResourceSelector');

const PROJECT_TOOLS = 'csnr-devops-lab-tools'
const PROJECT_DEPLOY = 'csnr-devops-lab-deploy'

describe('OpenShiftClientX', function() {
  this.timeout(999999);
  const oc = new OpenShiftClientX({namespace:PROJECT_TOOLS})

  afterEach(function () {
    // completely restore all fakes created through the sandbox
    sandbox.restore();
  });

  it('startBuild @this', async function() {
    var params={NAME:'my-test-app'}

    var stub = sandbox.stub(oc, '_action')

    var filePath = `${__dirname}/resources/bc.template.json`
    var processResult= lib.process(filePath,{param:params});

    stub.withArgs(
      ["--namespace=csnr-devops-lab-tools","process","-f",`${__dirname}/resources/bc.template-core.json`,"--param=NAME=my-test-app","--output=json"]
    ).returns({status:0, stdout:JSON.stringify({kind:'List', items:[{kind:'ImageStream', metadata:{name:params.NAME}}, {kind:'BuildConfig', metadata:{name:params.NAME}}]})})

    stub.callsFake(function fakeFn(args, input) {
      var hash = util.hashObject({args:args, input:input})
      if (input == null ){
        var proc = require('child_process').spawnSync('oc', args, {cwd:__dirname, encoding:'utf-8'})
        if (proc.status == 0){
          fs.writeFileSync(`${__dirname}/resources/oc-${hash}.cache.json`, proc.stdout)
          fs.writeFileSync(`${__dirname}/resources/oc-${hash}.cache.cmd.txt`, ['oc'].concat(args).join(' '))

          console.log(`cache file created: ./resources/oc-${hash}.cache.json`)
        }
      }
      console.log(`${JSON.stringify(args)}\n${JSON.stringify(input)}`)
      //console.log(`${['oc'].concat(args).join(' ')} > 'oc-${hash}.out.json'`)
      
      throw new Error(`Not Implemented: ${['oc'].concat(args).join(' ')}`)
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

    
    stub.withArgs(
      ["--namespace=csnr-devops-lab-tools","apply","-f","-","--output=name"], JSON.stringify(oc.wrapOpenShiftList(processResult))
    ).returns({status:0, stdout:`imagestream.image.openshift.io/${params.NAME}-core\nimagestream.image.openshift.io/${params.NAME}\nbuildconfig.build.openshift.io/${params.NAME}-core\nbuildconfig.build.openshift.io/${params.NAME}`})


    var filterByFullName= (fullNames)=>{
      var subset = processResult.filter((item)=>{
        var fullName = util.fullName(item)
        return fullNames.includes(fullName)
      })
      return subset
    }
    var subset1 = filterByFullName(["csnr-devops-lab-tools/buildconfig.build.openshift.io/my-test-app-core","csnr-devops-lab-tools/buildconfig.build.openshift.io/my-test-app"])
    

    stub.withArgs(
      ["--namespace=csnr-devops-lab-tools","get","buildconfig.build.openshift.io/my-test-app-core","buildconfig.build.openshift.io/my-test-app","--output=json"]
    ).returns({status:0, stdout:JSON.stringify(oc.wrapOpenShiftList(subset1))})

    stub.withArgs(
      ["--namespace=csnr-devops-lab-tools","get","imagestream.image.openshift.io/my-test-app-core","--output=json"]
    ).returns({status:0, stdout:JSON.stringify(oc.wrapOpenShiftList(filterByFullName(["csnr-devops-lab-tools/imagestream.image.openshift.io/my-test-app-core"])))})

    stub.withArgs(
      ["--namespace=csnr-devops-lab-tools","get","imagestream.image.openshift.io/my-test-app","--output=json"]
    ).returns({status:0, stdout:JSON.stringify(oc.wrapOpenShiftList(filterByFullName(["csnr-devops-lab-tools/imagestream.image.openshift.io/my-test-app"])))})

    stub.withArgs(
      ["--namespace=openshift","get","imagestream.image.openshift.io/python","--output=json"]
    ).returns({status:0, stdout:fs.readFileSync(`${__dirname}/resources/oc-607be20fff1241a2cd34534dfcadf0add63db2f9.cache.json`)})
    
    stub.withArgs(
      ["--namespace=csnr-devops-lab-tools","start-build","csnr-devops-lab-tools/buildconfig.build.openshift.io/my-test-app-core","--wait=true","--output=name"]
    ).returns({status:0, stdout:`Build/my-test-app-core-1`})

    const build1={
      kind:'Build',
      metadata:{
        name: 'my-test-app-core-1',
        namespace: 'csnr-devops-lab-tools'
      },
      status:{
        phase: "Complete"
      }
    }

    stub.withArgs(
      ["--namespace=csnr-devops-lab-tools","get","Build/my-test-app-core-1","--output=json"]
    ).returns({status:0, stdout:JSON.stringify(build1)})

    stub.withArgs(
      ["--namespace=csnr-devops-lab-tools","start-build","csnr-devops-lab-tools/buildconfig.build.openshift.io/my-test-app","--wait=true","--output=name"]
    ).returns({status:0, stdout:`Build/my-test-app-1`})

    const build2={
      kind:'Build',
      metadata:{
        name: 'my-test-app-1',
        namespace: 'csnr-devops-lab-tools'
      },
      status:{
        phase: "Complete"
      }
    }

    stub.withArgs(
      ["--namespace=csnr-devops-lab-tools","get","Build/my-test-app-1","--output=json"]
    ).returns({status:0, stdout:JSON.stringify(build2)})

    var applyResult = oc.apply(processResult)
    expect(applyResult).toBeInstanceOf(OpenShiftResourceSelector)
    expect(applyResult.names()).toEqual([`imagestream.image.openshift.io/${params.NAME}-core`, `imagestream.image.openshift.io/${params.NAME}`, `buildconfig.build.openshift.io/${params.NAME}-core`, `buildconfig.build.openshift.io/${params.NAME}`])    
    var bc = applyResult.narrow('bc')
    expect(bc.names()).toEqual([`buildconfig.build.openshift.io/${params.NAME}-core`, `buildconfig.build.openshift.io/${params.NAME}`])    

    await bc.startBuild({wait:'true'})

  }) //end it
}) //end describe