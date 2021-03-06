// Import important modules
import $ from 'jquery'
import async from 'async'
import ComponentParser from 'unobuilder-component-parser'
// import { extend, omit } from 'lodash'

// Define static vars
const errorMessages = {
  eventRequired: 'UNO: An event type must be specified',
  cannotBeObject: 'UNO: An event type cannot be an Object',
  typeAndCallbackRequired: 'UNO: Event type and callback must be specified',
  allRequired: 'UNO: Event type, route and callback function must be specified',
  JSONNotfound: 'UNO: component.json not found',
  TemplateNotfound: 'UNO: template.html not found',
  invalidJSON: 'UNO: Your JSON is invalid',
  invalidTemplate: 'UNO: Your Template is invalid',
  optionsUndefined: 'UNO: Options Undefined'
}

// const actionObjectException = [
//   'template',
//   'path',
//   'settings',
//   'beforeInit',
//   'afterInit',
//   'dragStart',
//   'dragMove',
//   'dragEnd',
//   'added',
//   'ready'
// ]

const componentType = {
  COMPONENT: 'component',
  BLOCK: 'block'
}

/**
 * Unobuilder global framework to register components
 */
class UnoBuilder {
  constructor () {
    this.__registry__ = {
      eventList: {},
      components: {},
      blocks: {},
      url: null,
      element: null,
      builder: null,
      queue: null
    }

  /**
   * Async queues to add component or block
   */
    this.__registry__.queue = async.queue((task, next) => {
      const fn = task.type === componentType.COMPONENT
        ? 'initComponent'
        : 'initBlock'

      this[fn](task.url)
        .then(() => {
          next()
          task.resolve()
        })
    }, 1)
  }

  /**
   * Init builder
   * @param  {String} element
   * @return {Object}
   */
  builder (element) {
    this.__registry__.builder = element
    this.emit('prepare', element)
    return this
  }

  /**
   * get builder selector
   * @return {String}
   */
  getBuilderSelector () {
    return this.__registry__.builder
  }

  /**
   * Get builder url
   * @return {String}
   */
  getBuilderUrl () {
    return this.__registry__.url
  }

  /**
   * Uno load URL to uno canvas
   * @param {Object} options
   */
  loadCanvas (options) {
    if (options.url && options.element) {
      const registry = this.__registry__
      registry.url = options.url
      registry.element = options.element
      this.emit('init', {
        builder: registry.builder,
        canvas: options.element
      })
    } else {
      throw new Error(errorMessages.optionsUndefined)
    }
    return this
  }

  /**
   * Uno event register
   * @param  {String} eventType
   * @param  {Function} fn
   */
  on (...args) {
    const argsLength = args.length
    let eventType
    let fn
    let callback

    switch (argsLength) {
      case 0:
        throw new Error(errorMessages.typeAndCallbackRequired)

      case 1:
        throw new Error(errorMessages.typeAndCallbackRequired)

      case 2:
        eventType = args[0]
        fn = args[1]
        if (typeof eventType === 'string' && typeof fn === 'function') {
          callback = fn
        } else {
          throw new Error(errorMessages.allRequired)
        }
        break
    }

    const { eventList } = this.__registry__

    // eventType doesn't exist, create new one
    if (!eventList[eventType]) {
      eventList[eventType] = []
    }

    eventList[eventType].push({
      callback
    })

    return this
  }

  /**
   * Turn off event
   * @param  {String} eventType [description]
   */
  off (...args) {
    const argsLength = args.length
    let eventType

    switch (argsLength) {
      case 0:
        throw new Error(errorMessages.eventRequired)

      case 1:
        eventType = args[0]
        if (typeof eventType !== 'string') {
          throw new Error(errorMessages.cannotBeObject)
        }
        break
    }

    const { eventList } = this.__registry__

    if (eventList[eventType]) {
      delete eventList[eventType]
    }

    return this
  }

  /**
   * Uno event emitter
   * @param  {String} eventType
   * @param  {Object|String|Number|Array} variables
   */
  emit (...args) {
    const argsLength = args.length
    const eventType = args[0]
    let variables
    let vars

    switch (argsLength) {
      case 0:
        throw new Error(errorMessages.eventRequired)
      case 2:
        variables = args[1]
        vars = variables
        break
    }

    const { eventList } = this.__registry__

    if (eventList[eventType]) {
      const arr = eventList[eventType]
      // emit callback
      for (let i = 0; i < arr.length; i++) {
        arr[i].callback && arr[i].callback.call(this, vars)
      }
    }
  }

  /**
   * Get event list
   * @return {Object} eventList
   */
  events () {
    return this.__registry__.eventList
  }

  /**
   * Reset Events
   */
  resetEvents () {
    let { eventList } = this.__registry__
    eventList = {}
    return eventList
  }

  addQueue (url, type) {
    return new Promise(resolve => {
      this.__registry__.queue.push({ url, type, resolve })
    })
  }

  /**
   * Uno add component to list
   * @param {String} url
   */
  addComponent (url) {
    return this.addQueue(url, componentType.COMPONENT)
  }

  /**
   * Uno add block to list
   * @param {String} url
   */
  addBlock (url) {
    return this.addQueue(url, componentType.BLOCK)
  }

  /**
   * Load uno component
   *
   * @param {any} scriptPath
   * @param {any} element
   * @returns
   *
   * @memberOf UnoBuilder
   */
  loadElement (url, element) {
    return new Promise((resolve, reject) => {
      $.get(`${ url }`, res => {
        ComponentParser(res).then(data => resolve(data))
      }).fail(() => reject(new Error(`${ errorMessages.TemplateNotfound }, url: ${ url }`)))
    })
  }

  /**
   * Uno init element (block / component)
   * @param {String} url
   */
  initElement (type, url) {
    const errorLogger = err => console.error(err)
    return this.loadElement(url, type)
      .catch(errorLogger)
      .then(element => {
        const { template, script } = element
        const { settings, events } = script
        // Get component object from js file
        // For closure purpose
        const data = {
          _id: template.id,
          path: url,
          settings,
          template,
          events
        }

        this.registerComponent(script)

        // Add component to list
        this.__registry__[`${ type }s`][data.settings.id] = data
      })
  }

  initComponent (url) {
    return this.initElement(componentType.COMPONENT, url)
  }

  initBlock (url) {
    return this.initElement(componentType.BLOCK, url)
  }

  getComponentList () {
    return this.__registry__.components
  }

  getComponentItem (item) {
    const { components } = this.__registry__
    if (item in components) {
      return components[item]
    }
  }

  getComponentItemById (id) {
    return new Promise(resolve => {
      const { components } = this.__registry__
      Object.keys(components).forEach(k => {
        const v = components[k]
        if (v._id === id) {
          resolve(v, k)
        }
      })
    })
  }

  getComponentNameById (id) {
    return this.getComponentItemById(id).then((v, k) => k)
  }

  getBlockList () {
    return this.__registry__.blocks
  }

  getBlockItem (item) {
    const { blocks } = this.__registry__
    if (item in blocks) {
      return blocks[item]
    }
  }

  /**
   * Register element (block or component)
   * @param {String} name
   * @param {Object} options
   */
  registerElement (element, name, options) {
    const registry = this.__registry__
    if (options) {
      // Call before init event
      if (options.events.beforeInit) {
        options.events.beforeInit.call(registry[element][name])
      }

      // Call after init event
      if (options.events.afterInit) {
        options.events.afterInit.call(registry[element][name])
      }
    }

    return this
  }

  /**
   * Register components
   */
  registerComponent (object) {
    const { settings } = object
    this.registerElement(componentType.COMPONENT + 's', settings.id, object)
    return this
  }

  /**
   * Register blocks
   */
  registerBlock (object) {
    const { settings } = object
    this.registerElement(componentType.BLOCK + 's', settings.id, object)
    return this
  }
}

global.uno = new UnoBuilder()

export default global.uno
