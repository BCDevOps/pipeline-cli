'use strict';
const OpenShiftClient = require('./OpenShiftClient')
const Transformers = require('./transformers')
const isArray = require('lodash.isarray');
const isPlainObject = require('lodash.isplainobject');
const isOpenShiftList = require('./isOpenShiftList')
const util = require('./util')
const CONSTANTS = require('./constants')

const logger = {
  info: require('debug')('info:OpenShiftClient'),
  trace: require('debug')('trace:OpenShiftClient')
}

module.exports = class OpenShiftClientX extends  OpenShiftClient {
  constructor(options){
    super(options)
    this.cache = new Map()
  }
  applyBestPractices (resources) {
    if ((resources != null) && !isOpenShiftList(resources)) throw "'resources' argument must be an array"
    const transformers = new Transformers(this)
    resources.items.forEach (resource  => {
      transformers.ENSURE_METADATA(resource);
      transformers.ADD_CHECKSUM_LABEL(resource);
      transformers.ENSURE_METADATA_NAMESPACE(resource, resources);
      transformers.REMOVE_BUILD_CONFIG_TRIGGERS(resource);
      transformers.ADD_SOURCE_HASH(resource);
    })
  }
  getLabel (resource, name) {
    resource.metadata = resource.metadata || {}
    resource.metadata.labels = resource.metadata.labels || {}
    return resource.metadata.labels[name]
  }
  setLabel (resource, name, value) {
    resource.metadata = resource.metadata || {}
    resource.metadata.labels = resource.metadata.labels || {}
    if (isPlainObject(name)){
      Object.assign(resource.metadata.labels, name)
    }else{
      resource.metadata.labels[name] = value
    }
  }
  getAnnotation (resource, name) {
    resource.metadata = resource.metadata || {}
    resource.metadata.annotations = resource.metadata.annotations || {}
    return resource.metadata.annotations[name]
  }
  //TODO:
  /*
  setAnnotation (resource, name, value) {
    resource.metadata = resource.metadata || {}
    resource.metadata.annotations = resource.metadata.annotations || {}
    if (isPlainObject(name)){
      Object.assign(resource.metadata.annotations, name)
    }else{
      resource.metadata.annotations[name] = value
    }
  }
  */
  applyRecommendedLabels (resources, appName, envName, envId, instance) {
    if ((resources != null) && !isArray(resources)) throw "'resources' argument must be an array"

    const commonLabels = {'app-name':appName}
    const envLabels={'env-name':envName, 'env-id':envId}
    const allLabels = {'app':(instance || `${commonLabels['app-name']}-${envLabels['env-name']}-${envLabels['env-id']}`)}

    Object.assign(allLabels, commonLabels, envLabels)

    //Apply labels to the list itself
    //client.util.label(resources, allLabels)

    resources.forEach((item)=>{
      if (this.getLabel(item, 'shared') === 'true'){
        this.setLabel(item, commonLabels)
      }else{
        this.setLabel(item, allLabels)
      }
    })

    return resources
  }

  fetchSecretsAndConfigMaps(resources){
    if ((resources != null) && !isArray(resources)) throw "'resources' argument must be an array"

    for (var i = 0; i < resources.length; i++) {
      var resource=resources[i]
      if (resource.kind === "Secret" || resource.kind === "ConfigMap"){
        var refName=this.getAnnotation(resource, "as-copy-of")
        if (refName!=null){
          const refResource= this.get(`${resource.kind}/${refName}`)
          resource.data =  refResource.data
          const tmpStringData=resource.stringData
          resource.stringData = {}
          if (resource.kind === "Secret" && tmpStringData['metadata.name']){
            resource.stringData['metadata.name'] = resource.metadata.name
          }
          var preserveFields = this.getAnnotation(resource, "as-copy-of/preserve");
          if (resource.kind === "Secret"  && preserveFields){
            const existingResource= this.get(`${resource.kind}/${resource.metadata.name}`, {'ignore-not-found':'true'})
            resource.data[preserveFields] = existingResource.data[preserveFields]
          }
        }
      }else if (resource.kind === "Route"){
        var refName=this.getAnnotation(resource, "tls/secretName")
        if (refName!=null){
          const refResource= this.get(`${resource.kind}/${refName}`)
          const refData = refResource.data
          for (var prop in refData) {
            if(!refData.hasOwnProperty(prop)) continue;
            refData[prop] = Buffer.from(refData[prop], 'base64').toString('ascii')
          }
          resource.spec.tls = resource.spec.tls || {}
          Object.assign(resource.spec.tls, refData)
        }
      }
    }
    return resources
  }

  process(object, args){
    //instance = app
    var resources = super.process(object, args)
    
    //this.applyRecommendedLabels(resources, appName, envName, envId, instance)
    return resources
  }
  _setCache(resource){
    if (isArray(resource)){
      var entries = []
      for(var i = 0; i< resource.length; i++){
        entries.push(this._setCache(resource[i]))
      }
      return entries
    }else{
      var resourceFullName=util.fullName(resource)
      var entry = {item:resource, fullName:resourceFullName, name:util.name(resource)}
      this.cache.set(resourceFullName, entry)
      return entry
    }
  }
  _getCache(name){
    var _names = []
    var entries = []
    var missing = []

    if (isArray(name)){
      _names.push(...name)
    }else{
      _names.push(name)
    }

    //look for missing resources from cache
    for(var i = 0; i< _names.length; i++){
      var _name =  _names[i]
      var _parsed = util.parseName(_name, this.namespace())
      var _full = util.fullName(_parsed)
      var entry = this.cache.get(_full)
      if (entry == null){
        missing.push(_full)
      }
    }

    //fetch missing resources
    if (missing.length>0){
      var objects = this.objects(missing)
      this._setCache(objects)
    }

    //populate entries
    for(var i = 0; i< _names.length; i++){
      var _name = _names[i]
      var _parsed = util.parseName(_name, this.namespace())
      var _full = util.fullName(_parsed)
      var entry = this.cache.get(_full)
      if (entry == null ) throw new Error(`Missing object:${_name}`)
      entries.push(entry)
    }
    return entries
  }

  getBuildStatus (buildCacheEntry) {
    if (!buildCacheEntry || !buildCacheEntry.item){
      return undefined;
    }
    return this.cache.get(util.fullName(buildCacheEntry.item))
  }

  async pickNextBuilds (builds, buildConfigs) {
    //var buildConfigs = _buildConfigs.slice()
    //const maxLoopCount = buildConfigs.length * 2
    var currentBuildConfigEntry = null
    //var currentLoopCount = 0
    var promises = []
  
    var head = undefined
    logger.trace(`>pickNextBuilds from ${buildConfigs.length} buildConfigs`)
    while((currentBuildConfigEntry=buildConfigs.shift()) !== undefined){
      if (head === undefined) {
        head = currentBuildConfigEntry
      }else if( head === currentBuildConfigEntry){
        buildConfigs.push(currentBuildConfigEntry)
        break;
      }
  
      const currentBuildConfig = currentBuildConfigEntry.item;
      const buildConfigFullName = util.fullName(currentBuildConfig)
      const dependencies= currentBuildConfigEntry.dependencies
      var resolved=true
  
      //logger.trace(`Trying to queue ${buildConfigFullName}`)
  
      for (var i = 0; i < dependencies.length; i++) {
        var parentBuildConfigEntry = dependencies[i].buildConfigEntry
        logger.trace(`${buildConfigFullName}  needs ${util.fullName(dependencies[i].item)}`)
        if (parentBuildConfigEntry){
          logger.trace(`${buildConfigFullName}  needs ${util.fullName(parentBuildConfigEntry.item)}`)
          //var parentBuildConfig = parentBuildConfigEntry.item
          if (!parentBuildConfigEntry.imageStreamImageEntry){
            var parentBuildEntry = parentBuildConfigEntry.buildEntry
            var buildStatus = this.getBuildStatus(parentBuildEntry)
            if (buildStatus === undefined){
              resolved =false
              break;
            }
          }
        }
      }
  
      //dependencies have been resolved/satisfied
      if (resolved){
        logger.trace(`Queuing ${buildConfigFullName}`)
        const self = this
        const _startBuild = super.startBuild.bind(self)
        const _bcCacheEntry = currentBuildConfigEntry

        promises.push(Promise.resolve(currentBuildConfig).then((bc)=>{
          return _startBuild(util.fullName(currentBuildConfig), {wait:true})
        }).then( build => {
          var _names = build.identifiers()
          _bcCacheEntry.buildEntry=self._setCache(self.objects(_names))[0]
          if (build!=null){
            builds.push(... _names);
          }
        }))
  
        if( head === currentBuildConfigEntry){
          head = undefined
        }
      }else{
        buildConfigs.push(currentBuildConfigEntry)
        logger.trace(`Delaying ${buildConfigFullName}`)
        //logger.trace(`buildConfigs.length =  ${buildConfigs.length}`)
      }
    } // end while
  
    var p = Promise.all(promises)
    //logger.trace(`buildConfigs.length =  ${buildConfigs.length}`)
    if (buildConfigs.length > 0){
      const pickNextBuilds = this.pickNextBuilds.bind(this)
      p=p.then(function() {
        return pickNextBuilds(builds, buildConfigs)
      });
    }
    return p;
  }

  async startBuild(resources, args){
    logger.info('>startBuilds')
    //var cache = new Map()



    var buildConfigs = this._setCache(this.objects(resources))
    var _imageStreams = []

    buildConfigs.forEach((entry)=>{
      var bc = entry.item
      var buildConfigFullName = util.fullName(bc)
      logger.trace(`Analyzing ${buildConfigFullName} - ${bc.metadata.namespace}`)
      var outputTo = bc.spec.output.to
      if (outputTo){
        if (outputTo.kind === CONSTANTS.KINDS.IMAGE_STREAM_TAG){
          var name=outputTo.name.split(':')
          var imageStreamFullName = `${outputTo.namespace || bc.metadata.namespace}/${CONSTANTS.KINDS.IMAGE_STREAM}/${name[0]}`
          var imageStreamCacheEntry = this._getCache(imageStreamFullName)[0]
          imageStreamCacheEntry.buildConfigEntry = entry
          //indexOfBuildConfigByOutputImageStream.set(imageStreamFullName, bc)
        }else{
          throw new Error(`Expected '${CONSTANTS.KINDS.IMAGE_STREAM_TAG}' but found '${outputTo.kind}' in ${buildConfigFullName}.spec.output.to`)
        }
        
      }

      var dependencies = []

      util.getBuildConfigInputImages(bc).forEach(sourceImage => {
        if (sourceImage.kind === CONSTANTS.KINDS.IMAGE_STREAM_TAG){
          var name=sourceImage.name.split(':')
          var imageStreamFullName = `${sourceImage.namespace || bc.metadata.namespace}/${CONSTANTS.KINDS.IMAGE_STREAM}/${name[0]}`
          dependencies.push(this._getCache(imageStreamFullName)[0])
        }else{
          die(`Expected '${CONSTANTS.KINDS.IMAGE_STREAM_TAG}' but found '${sourceImage.kind}' in ${fullName(buildConfigFullName)}`)
        }
      })
      entry.dependencies= dependencies
    })
    
    const builds= []
    return await this.pickNextBuilds(builds, buildConfigs).then(()=>{ return builds; })
    
    //super.startBuild(object, args)
  }
}
