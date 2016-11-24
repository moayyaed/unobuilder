/* Our Applications */
import cssRenderer from './components/CSSRenderer.vue'
import _ from 'lodash'
import dot from 'dot-object'
import classList from './lib/classlist.js'
import Mousetrap from './lib/mousetrap.min.js'
import utils from './utils.js'
import client from './client.js'
import config from './config.js'

/* Main app */
const Viewer = {}
Viewer.window = null
Viewer.element = null
Viewer.mixins = {
	components: {cssRenderer},

	/**
	 * Main Data
	 */
	data () {
		return {
			propertyState: 'global',
			screenSize: 'large',
			activeElement: null,
			hoverElement: null,
			copiedElement: null,
			cuttingElement: false,
			componentElement: null,
			dragComponent: false,
			dropElement: null,
			overlapElement: null,
			dragElementState: {
				x: 0, y: 0,
				move: false,
				element: null,
				cloneElement: null
			},
			contentElement: null,
			editContent: false,
			customCSS: '',
			global: {},
			elements: {}
		}
	},

	watch: {
		'propertyState': {
			handler () {
				this.trySelect()
			}
		}
	},

	/**
	 * Method collections
	 * @type {Object}
	 */
    methods: {
		/**
		 * Get Viewer reference
		 * @param str {String}
		 * @param el {String}
		 * @return
		 */
		ref (str, el) {
			return utils.ref(this, str, el)
		},

        /**
		 * Element outline
		 *
		 * @param  {ElementNode} target
		 * @return {void}
		 */
		outline (target) {
			let offset = $(target).offset(),
			width = target.offsetWidth,
			height = target.offsetHeight

			let outline = {
				$top: offset.top,
				top: 0,
				left: 0,
				$left: offset.left,
				width: `${width-2}px`,
				$width: width,
				height: `${height-2}px`,
				$height: height,
				transform: `translate(${offset.left}px, ${offset.top}px)`
			}

			switch (target.$kind) {
				/*case 'container':
					let containerOffset = $(target.$element()).offset()
					outline.$outerLeft = containerOffset.left
					outline.$outerTop = containerOffset.top
					outline.$outerWidth = target.parentElement.parentElement.offsetWidth
					outline.$outerHeight = target.parentElement.parentElement.offsetHeight
				break;

				case 'section':
					let sectionOffset = $(target.$element()).offset()
					outline.$outerLeft = sectionOffset.left
					outline.$outerTop = sectionOffset.top
					outline.$outerWidth = target.parentElement.offsetWidth
					outline.$outerHeight = target.parentElement.offsetHeight
				break;

				case 'column':
					let columnOffset = $(target.$element()).offset()
					outline.$outerLeft = columnOffset.left
					outline.$outerTop = columnOffset.top
					outline.$outerWidth = target.parentElement.parentElement.offsetWidth
					outline.$outerHeight = target.parentElement.parentElement.offsetHeight
				break;*/
			}

			return outline
		},

		/**
		 * Set default size (width & height) of an element
		 * @param {Object} props
		 * @param {Object} element
		 *
		 * @return {Object}
		 */
		setDefaultSize (props, element) {
			// Change properties of data kind
			switch (element.kind) {
				case 'column':
					//let width = 100 / data.totalColumn
					if (!props.width) {
						props.width = {value: 100, unit: '%'}
					}
					props.minWidth = {value: 60, unit: 'px'}
					props.maxWidth = {value: '', unit: '%'}
					props.height = {value: '', unit: 'px'}
					props.minHeight = {value: 60, unit: 'px'}
					//delete data.totalColumn
				break

				case 'element':
					props.minWidth = {value: 60, unit: 'px'}
					props.maxWidth = {value: '', unit: '%'}
					props.minHeight = {value: 60, unit: 'px'}
				break

				case 'image':
					props.minWidth = {value: 250, unit: 'px'}
					props.minHeight = {value: 250, unit: 'px'}
				break

				case 'section':
					// props.width.disabled = true
					// props.minWidth.disabled = true
					// props.maxWidth.disabled = true
					props.height = {value: 'auto', unit: 'px'}
					props.minHeight = {value: 60, unit: 'px'}
				break

				case 'container':
					// props.width.disabled = true
					// props.minWidth.disabled = true
					// props.maxWidth.disabled = true
					props.height = {value: 'auto', unit: '%'}
					props.minHeight = {value: 60, unit: 'px'}
				break
			}

			return props
		},


    /**
     * Create element
     * @param  {Object} element
     * @param  {Number|Function} insertAt, fn
     * @return {Node}
     */
    createElement (element, insertAt, fn) {
			// Fix arguments
			let ready = fn
			if (typeof insertAt === 'function') {
				ready = insertAt
			}


			let el = Viewer.window.document.createElement(element.tag),
			id = utils.generateId()

			// Add random ID
            el.$id = element.id || id
			el.setAttribute('data-id', id)

			// Element classes
			el.$klass = _.extend(['$klass-'], element.$klass)

			// Set Attributes
			el.$setAttr = (key, value) => {
				el.setAttribute(key, value)
			}

			// Join $klass array separated by space
			el.$klassify = (val) => {
				let klass = el.$klass.map(item => item.replace('$klass-', ''))
				klass = _.uniq(klass).join(' ')
				return klass
			}

			// Render klass
			el.$renderKlass = () => {
				el.$setAttr('class', el.$klassify())
			}

			// Add klass
			el.$addKlass = (val, noPrefix) => {
				let klassName = (noPrefix)? val: utils.klass(val)
				el.$klass.push(klassName)
			}

			// Remove klass
			el.$removeKlass = (val, noPrefix) => {
				let klassName = (noPrefix)? val: utils.klass(val),
				klass = el.$klass.filter(item => item !== klassName)
				el.$klass = klass
			}

			// Set dynamic class
			el.$setClass = (value) => {
				let klassVar = '$klass-',
				classIndex = el.$klass.map(i => i.indexOf(klassVar)>-1).indexOf(true)

				el.$klass[classIndex] = klassVar + value
				el.$setAttr('class', el.$klassify())
			}

			// Only for selectable element
			if (element.selectable === undefined) {
				element.selectable = true
			}

			// Clone element to avoid binding
			let structure = utils.cloneObject(element, true)
			el.$structure = structure
			this.elements[el.$id] = _.extend({
				id: el.$id
			}, el.$structure)

			// Set wrapper
			// Set default attributes
			if (element.wrapper) {
				el.$wrap = true
				el.$addKlass('el-wrapper')
			} else {
				// Apply Attributes and Properties
				let props = utils.cloneObject(config.PROPERTIES)

				if (this.elements[el.$id].props) {
					props = _.extend(props, this.elements[el.$id].props)
				}

				props = this.setDefaultSize(props, element)
				if (! this.global[element.kind]) {
					let propsModifier = {
						column: {
							width: {disabled: true},
							minWidth: {disabled: true},
							maxWidth: {disabled: true},
							height: {disabled: true},
							minHeight: {disabled: true},
							maxHeight: {disabled: true}
						}
					}

					for (let elKind in propsModifier) {
						if (element.kind === elKind) {
							let propsValue = propsModifier[elKind]
							for (let key in propsValue) {
								props[key] = _.extend(props[key], propsValue[key])
							}
						}
					}

					this.global[element.kind] = {
						large: props
					}
				}

				// Default properties from cloned props
				let properties = {
					self: {}
				}

				// If element.propsclone is setted
				// Override properties
				if (element.propsclone) {
					let elementAttributes = this.elements[element.propsclone]
					if (elementAttributes) {
						properties = utils.cloneObject(elementAttributes.props, true)
					}
				}

				// Global properties
				let global = this.global[element.kind]
				Object.defineProperty(properties, 'global', {
					get () {
						return global
					}
				})

				// Okie dogie
				this.elements[el.$id].props = properties
			}

			// Add class if element is selectable
			if (element.selectable) {
				el.$selectable = true
				el.$addKlass('el')
				el.$addKlass('el-' + this.elements[el.$id].kind)
				el.$addKlass('el-' + this.elements[el.$id].type)
			} else {
				el.$addKlass('non-el')
			}

			// Editable content
			if (element.editable === undefined) {
				element.editable = false
			}
			el.$editable = element.editable

			// Resizable element
			if (element.resizable === undefined) {
				element.resizable = false
			}
			el.$resizable = element.resizable

			// Subtree is for case like row
			// Template is wrapper but unselectable
			// And it's only a shadow
			if (element.row) {
				el.$row = true
			}

			// Get data properties
			el.$props = (mouseState = '', screenSize) => {
				let state = this.propertyState
				let element = this.elements[el.$id]
				let propsCollection = element.props.global
				let screenAvailable = ['large', 'medium', 'small', 'mini']
				let currentScreenSize = screenSize || this.screenSize
				let currentScreenIndex = screenAvailable.indexOf(currentScreenSize)
				let propsKey = ''
				let props = {}

				// If self properties is not defined
				// Get properties from global
				if (state !== 'global' && ! _.isEmpty(element.props.self)) {
					propsCollection = element.props.self
				}

				if (propsCollection[currentScreenSize + mouseState]) {
					propsKey = currentScreenSize + mouseState
				} else {
					// Get screen properties
					// If not available get larger screen size
					while (true) {
						currentScreenSize = screenAvailable[currentScreenIndex]
						if (propsCollection[currentScreenSize]) {
							break
						}
						currentScreenIndex--
					}

					propsKey = currentScreenSize
				}

				props = propsCollection[propsKey]
				return props
			}

			// Element offset
			el.$offset = (prop) => {
				let rect =  el.getBoundingClientRect()
				if (prop) {
					return rect[prop]
				}

				return rect
			}

			// Get element absolute position
			el.$coords = (pos) => {
				let left = el.$offset('left'), top = el.$offset('top'),
				retval = {
					left: left,
					right: left + el.$offset('width'),
					top: top,
					bottom: top + el.$offset('height')
				}

				if (pos) {
					return retval[pos]
				}

				return retval
			}

			// Traversing child elements
			el.$find = (id) => {
				let element = el.querySelector(`[data-id="${id}"]`)

				if (! element) {
					element = element.firstChild;
					while (element) {
						el.$find(element)
						element = element.nextSibling
					}
				} else {
					return element
				}
			}

			// Get breadcrumb
			el.$breadcrumb = () => {
				return {
					id: el.$id,
					label: el.$label
				}
			}

			// Get breadcrumbs
			el.$breadcrumbs = () => {
				let breadcrumbs = []

				// Current element
				let element = el.$element()
				if (element && element.$label) {
					breadcrumbs.push(element.$breadcrumb())

					// 2nd parent element
					let parent = element.$selectableParent()
					if (parent) {
						breadcrumbs.push(parent.$breadcrumb())

						// 3rd parent element
						let grandParent = parent.$selectableParent()
						if (grandParent) {
							breadcrumbs.push(grandParent.$breadcrumb())
						}
					}
				}

				return breadcrumbs
			}

			// Kind attributes
			el.setAttribute('data-kind', this.elements[el.$id].kind)
			el.$kind = this.elements[el.$id].kind || 'etc'

			// Type attributes
			el.setAttribute('data-type', this.elements[el.$id].type)
			el.$type = this.elements[el.$id].type || 'etc'

			// Tag Label
			el.$label = this.elements[el.$id].label || el.$kind

			// Accepted drag and drop parent
			el.$dropable = this.elements[el.$id].dropable

			if (this.elements[el.$id].options) {
				el.$options = this.elements[el.$id].options
			}

			el.$outline = () => {
				return this.outline(el)
			}

			// Select element
			el.$select = (isRightClick = false) => {
				if (el.$selectable) {
					let parent = el.$parentElement(),last = false

					// If parent is editable content, and in edit mode
					// Cancel it dont select outline
					if (parent && parent.$kind === 'content' && this.editComponent) {
						return
					}

					// Set active element
					this.activeElement = el.$id

					// Notify to element selector
					let selector = this.canvasBuilder('elementSelector')
					this.$nextTick(() => {
						selector.applyState({
							mode: 'select',
							id: el.$id,
							css: el.$outline(),
							type: el.$type,
							last: last,
							index: el.$index(),
							expand: false,
							childSize: 0,
							removeOver: false,
							rightClick: isRightClick,
							breadcrumbs: el.$breadcrumbs()
						})
					})
				}
			}

			// Hover element
			el.$hover = () => {
				if (el.$selectable) {
					this.hoverElement = el.$id
					this.$nextTick(() => {
						this.canvasBuilder('elementSelector').applyState({
							mode: 'hover',
							id: el.$id,
							css: el.$outline(),
							type: el.$type,
							expand: false,
							breadcrumbs: el.$breadcrumbs()
						})
					})
				}
			}

			// Drop-in element
			el.$dropIn = (position) => {
				if (el.$selectable) {
					this.canvasBuilder('elementSelector').dropAt(true, {
						id: el.$id,
						css: el.$outline(),
						type: el.$type,
						target: el,
						position
					})
				}
			}

			// Hide drop-in element
			el.$dropOut = () => {
				if (el.$selectable) {
					this.canvasBuilder('elementSelector').dropAt(false)
				}
			}

			// Overlay an element with transparent white overlay
			el.$overlay = () => {
				if (el.$selectable) {
					this.canvasBuilder('elementSelector').overlaying({
						id: el.$id,
						css: el.$outline(),
						type: el.$type,
						target: el
					})
				}
			}

			// Edit editable element
			el.$edit = (editable = false) => {
				this.editContent = editable
				this.contentElement = el.$id

				if (editable) {
					this.$nextTick(() => {
						this.canvasBuilder('elementSelector').applyState({
							mode: 'edit',
							id: el.$id,
							css: el.$outline(),
							type: el.$type,
							target: el,
							editable: editable
						})
					})
				}
			}

			el.$editorCSS = () => {
				let outline = el.$outline(),
				elHeight = outline.$top + $(el).outerHeight(true),
				css = {
					top: 0,
					left: 0,
					transform: `translate(${outline.$left}px, ${elHeight}px)`
				}

				return css
			}

			// Get tagName
			el.$tag = () => {
				return el.tagName.toLowerCase()
			}

			// Add child elements
			el.$add = (element, ready) => {
				el.appendChild(this.createElement(element, ready))
			}

			// Remove element
			el.$remove = () => {
				let childs = el.$childElements()
				for (let i in childs) {
					childs[i].$remove && childs[i].$remove()
				}

				delete this.elements[el.$id]
				el.remove()
			}


			// Get structure
			el.$structureTree = (clone) => {
				let structure = utils.cloneObject(el.$structure, true)
				if (clone) {
					structure.propsclone = el.$id
				}

				// If structure is editable elements
				// It must be has html object
				// So copy default html with new value
				if (structure.html) {
					structure.html = el.innerHTML
					structure.tmpElements = []
				}

				// Delete old structure
				delete structure.append
				delete structure.prepend
				structure.elements = []

				let childs = el.$childElements(), structureChilds = []
				for (let i in childs) {
					let childStructure = childs[i].$structureTree
					if (childStructure) {
						if (structure.tmpElements) {
							structure.tmpElements.push(childStructure(clone))
						} else {
							structure.elements.push(childStructure(clone))
						}

					}
				}

				return structure
			}

			// Check accepts of parent elements
			el.$dropableTo = (kind) => {
				if (el.$dropable) {
					if (typeof kind === 'object' && kind.nodeType === 1) {
						kind = kind.$kind
					}

					return el.$dropable.split(',').includes(kind)
				}
			}

			// Check accepting element
			el.$accepting = (accepted) => {
				if (typeof accepted === 'object' && accepted.nodeType === 1) {
					accepted = accepted.$dropable
				}

				if (accepted) {
					return accepted.split(',').includes(el.$kind)
				}
			}

			// Copy element to destination
			el.$copy = (to, callback) => {
				let copyElement = el.$structureTree(true),
				pasteElement = this.getElement(to, true),
				parent = el.parentElement

				if (pasteElement) {
					// If parent element is a row element
					// And paste element is not row element
					// Create new row element, by copying row element
					if (parent && parent.$row && !pasteElement.$row) {
						let parentElement = parent.$structureTree(true)
						parentElement.elements = [copyElement]
						copyElement = parentElement
					}

					// Only copy if accept arguments passed
					if (el.$dropableTo(pasteElement.$kind)) {
						copyElement.append = `[data-id="${pasteElement.$id}"]`
						this.createElement(copyElement, (element) => {
							element.$select()
							callback && callback.call(this)
						})
					}
				}
			}

			// Change tag element
			el.$changeTag = (tag) => {
				let newElement = this.createElement({
					tag: tag,
					kind: el.$kind,
					type: el.$type
				}, ready)

				// While element has first child
				while (el.firstChild) {
					newElement.appendChild(firstChild)
				}

				// Change data attributes if any
				for (let index = el.attributes.length - 1; index >= 0; --index) {
					newElement.attributes.setNamedItem(el.attributes[index].cloneNode());
				}

				el.parentNode.replaceChild(newElement, el)
			}

			// Get actual element
			// Select only when element has class uno-el
			el.$element = (parent) => {
				let element = parent || el

				if (element.$type && element.$type === 'body') {
					return element
				}

				if (element.$wrap) {
					return element.firstChild
				} else {
					return element
				}

				return element
			}

			// Get selectable element
			el.$selectableElement = () => {
				let element = el

				if (el.$type === 'child') {
					return el.$selectableParent()
				}

				return el
			}

			// Get wrapper element
			el.$wrapper = () => {
				if (el.parentElement.classList.contains(utils.klass('el-wrapper'))) {
					return el.parentElement
				}
			}

			// Get element wrapper if parent element is $wrapper
			el.$elementWrapper = () => {
				let wrapper = el.$wrapper(),
				wrapperEl = el

				if (wrapper) {
					wrapperEl = wrapper
				}

				return wrapperEl
			}

			// Get next element
			el.$next = () => {
				let nextEl = el.$elementWrapper()
				if (nextEl.nextSibling && nextEl.nextSibling.$element) {
					return nextEl.nextSibling.$element()
				}
			}

			// Get previous element
			el.$prev = () => {
				let prevEl = el.$elementWrapper()
				if (prevEl.previousSibling && prevEl.previousSibling.$element) {
					return prevEl.previousSibling.$element()
				}
			}

			// Get sibling element, if there is no next / previous then,
			// select it's parent
			el.$sibling = () => {
				let siblingEl = el.$elementWrapper()

				// Get next sibling
				if (siblingEl.nextSibling &&
					siblingEl.nextSibling.nodeType === 1) {
					siblingEl = siblingEl.nextSibling
				} else if (siblingEl.previousSibling &&
					siblingEl.previousSibling.nodeType === 1) {
					siblingEl = siblingEl.previousSibling
				} else {
					siblingEl = el.$parentElement()
				}

				return siblingEl.$element()
			}

			// Get next Sibling
			el.$nextSibling = () => {
				let nextSibling = el.$sibling()
				return nextSibling.$next()
			}

			// Get previous sibling
			el.$prevSibling = () => {
				let prevSibling = el.$sibling()
				return prevSibling.$prev()
			}

			// Get parent element
			el.$parentElement = (checkRowElement) => {
				let retElement, element = el.$element()
				if (element && element.parentElement) {
					if (element.parentElement.$wrap) {
						if (element.parentElement.parentElement && element.parentElement.parentElement.$element) {
							retElement = element.parentElement.parentElement.$element()
						}
					} else {
						if (element.parentElement.$element) {
							retElement = element.parentElement.$element()
						}
					}

					if (retElement && retElement.$row && checkRowElement) {
						retElement = retElement.parentElement
					}

					return retElement
				}
			}

			// Select parent until we found selectable element
			el.$selectableParent = () => {
				// let parent = el.parentElement
				// if (parent) {
				// 	if (!parent.$selectable && parent.$selectableParent) {
				// 		return parent.$selectableParent()
				// 	}
				//
				// 	return parent
				// }
				//
				// if (element.parentElement) {
				// 	if (element.parentElement.$selectable) {
				// 		return element.parentElement
				// 	}
				//
				// 	return this.searchSelectableParent(element.parentElement)
				// }
				return this.searchSelectableParent(el)
			}

			// Get element's parent, until met first child's node of body
			// for example: If we're in section>container>element>element
			// find section, section is first child's node of body/layout
			el.$firstParentFromLayout = () => {
				let parent = el.$selectableParent()
				if (parent) {
					if (parent.$type !== 'body') {
						return parent.$firstParentFromLayout()
					}

					return el
				}
			}

			// Get element's index from it's parent
			el.$index = () => {
				let index = 0,
				parent = el.$parentElement()

				if (parent) {
					let prevSibling = el
					while ((prevSibling = prevSibling.previousElementSibling) !== null) {
						if (prevSibling.nodeType === 1) {
							index++
						}
					}
				}

				return index
			}

			// Select child until we found selectable element
			el.$selectableChild = () => {
				let child = el.firstChild
				if (child) {
					if (!child.$selectable && child.$selectableChild) {
						return child.$selectableChild()
					}

					return child
				}
			}

			// Select parent until we found row element
			el.$rowParent = () => {
				let parent = el.parentElement
				if (parent) {
					if (!parent.$row && parent.$rowParent) {
						return parent.$rowParent()
					}

					return parent
				}
			}

			// Get child elements
			el.$childElements = () => {
				let childNodes = el.childNodes, children = [],
				i = childNodes.length

				while (i--) {
				    if (childNodes[i].nodeType === 1) {
				        children.unshift(childNodes[i]);
				    }
				}

				return children
			}

			// Update klass if element has no child
			el.$updateEmptiness = () => {
				if (el.$kind === 'body') return

				let element = el
				if (element.$type === 'child' && element.$kind !== 'column') {
					element = element.parentElement
				}

				let children = el.$selectableChild()
				if (! children) {
					element.$addKlass('el-empty')
				} else {
					element.$removeKlass('el-empty')
				}

				element.$renderKlass()
				if (element.parentElement) {
					element.parentElement.$updateEmptiness()
				}
			}

			// Set properties
			el.$set = (key, val, mouseState = '') => {
				let kind = el.$kind, propKey = this.screenSize + mouseState,
				currentProps = el.$props(mouseState),
				props = utils.cloneObject(currentProps)

				if (this.propertyState === 'global') {
					if (! this.global[kind][propKey]) {
						this.global[kind][propKey] = props
					}
					dot.set(key, val, this.global[kind][propKey])
				} else {
					// If we set id attribuet
					// They actually set to large screen only
					if (key === 'id') {
						propKey = 'large'
					}

					if (! this.elements[el.$id].props.self[propKey]) {
						this.elements[el.$id].props.self[propKey] = props
					}

					dot.set(key, val, this.elements[el.$id].props.self[propKey])
				}

				this.$nextTick(() => {
					this.updateStylesheet(true)
				})
			}

			// Get properties
			el.$get = (key, mouseState = '') => {
				// Only when we pick id attribute, screensize is always setAttr
				// to large
				let screenSize
				if (key === 'id') {
					screenSize = 'large'
				}

				return dot.pick(key, el.$props(mouseState, screenSize))
			}

			// Add html
			if (element.html) {
				el.innerHTML = element.html
			}

			// Prepend element to element.prepend value
			if (element.prepend) {
				let prependElement = Viewer.window.document.querySelector(element.prepend)
				targetEl = prependElement,
				where = 'afterbegin'

				if (typeof insertAt === 'number') {
					let childs = prependElement.$childElements()
					if (childs.length > 0) {
						targetEl = childs[insertAt]
						where = 'beforebegin'
					}
				}

				targetEl.insertAdjacentElement(where, el)
			}

			// Append element to element.append value
			if (element.append) {
				let appendElement = Viewer.window.document.querySelector(element.append),
				targetEl = appendElement,
				where = 'beforeend'

				if (typeof insertAt === 'number') {
					let childs = appendElement.$childElements()
					if (childs.length > 0) {
						targetEl = childs[insertAt]
						where = 'afterend'
					}
				}

				targetEl.insertAdjacentElement(where, el)
			}

			// Remove raw html with temporary elements
			if (element.tmpElements) {
				let childs = el.$childElements()

				// Find child ID
				// in clonedElement
				// and replace temporary element with uno elements
				for (let i in childs) {
					let childId = childs[i].getAttribute('data-id'),
					cloneElement = _.find(element.tmpElements, {propsclone: childId})

					if (cloneElement) {
						this.createElement(cloneElement, (element) => {
							childs[i].parentNode.replaceChild(element, childs[i])
						})
					}
				}
			}
			delete element.tmpElements

			// Finish
			this.$nextTick(() => {
				// Add custom attributes if any
				if (element.attrs) {
					for (let key in element.attrs) {
						let value = element.attrs[key]
						if (key === 'class') {
							el.$setClass(value)
						} else {
							el.$setAttr(key, value)
						}
					}
				} else {
					el.$setClass('')
				}

				// Rehover element
				this.tryHover()

				// If element has child
				// Add child elements
				if (element.elements && element.elements.length>0) {
					for (let i = 0; i<element.elements.length;i++) {
						if (i === element.elements.length-1) {
							el.$add(element.elements[i], ready)
						} else {
							el.$add(element.elements[i])
						}
					}
				} else {
					// Fire events ready
					ready && ready.call(this, el)

					// Update empty clas
					el.$updateEmptiness()

					// Update stylesheet and reselect it
					this.updateStylesheet(true)
				}
			})

			return el
		},

        /**
		 * Get builder application instance
		 * @param {String} ref
		 * @param {String} el
		 */
		builder (ref = '', el) {
			let builder = window.parent.document
			.querySelector(client.getBuilderSelector())
			.__vue__

			if (ref !== '') {
				return builder.ref(ref)
			}

			return builder
		},

		/**
		 * Get canvas builder object
		 * @param {String} ref
		 * @param {String} el
		 */
		canvasBuilder (ref, el) {
			return utils.ref(this.builder('centerPanel.canvasBuilder'), ref, el)
		},

		/**
		 * Get builder leftpanel
		 * @param {String} ref
		 * @param {String} el
		 */
		leftPanel (ref, el) {
			return utils.ref(this.builder('leftPanel'), ref, el)
		},

		/**
		 * On mouse over
		 *
		 * @param  {Event} event
		 * @return {void}
		 */
		over (event) {
			let element = event.target
			if (element.$selectable) {
				element.$hover()
			} else {
				if (element.parentElement.$hover) {
					element.parentElement.$hover()
				}
			}
		},

		/**
		 * On mouse leave
		 *
		 * @param  {Event} event
		 * @return {void}
		 */
		leave (event) {

		},

		/**
		 * Element clicked / Start drag
		 * @param  {Event} e
		 * @return {void}
		 */
		click (e) {
			// Hide context menu first
			this.builder().closeAllPanels()

			// Get possible element
			let element = e.target

			if (! element.$selectable) {
				element = this.searchSelectableParent(element)
			}

			if (element && element.$selectable) {
				// Set default state before we drag / click element
				// Body a.k.a layout cannot be dragged
				if (element.$element().$type === 'body' || e.which !== 1) {
					element.$select()
				} else {
					// Clone element with tiny dot element
					let cloneElement = Viewer.window.document.createElement('div')
					cloneElement.style.width = '15px'
					cloneElement.style.height = '15px'
					cloneElement.style.position = 'fixed'
					cloneElement.style.x = `${e.pageX}px`
					cloneElement.style.y = `${e.pageY}px`
					cloneElement.style.visibility = 'hidden'
					Viewer.window.document.body.appendChild(cloneElement)

					// Default drag state
					this.dragElementState.cloneElement = cloneElement
					this.dragElementState.element = element
					this.dragElementState.x = e.pageX
					this.dragElementState.y = e.pageY

					// Start dragging
					utils.addEvent(Viewer.window.document, 'mousemove', this.dragElementMove, false)
					utils.addEvent(Viewer.window.document, 'mouseup', this.dragElementEnd, false)
				}
			}
		},

		/**
		 * Moving element to another element
		 * @param  {Event} e
		 * @return {void}
		 */
		dragElementMove (e) {
			let cloneRect = this.dragElementState.cloneElement.getBoundingClientRect()
			let x = (e.pageX - (cloneRect.width/2))
			let y = (e.pageY - (cloneRect.height/2)) - Viewer.window.document.body.scrollTop

			// Move clone element
			this.dragElementState.cloneElement.style.left = `${x}px`
			this.dragElementState.cloneElement.style.top = `${y}px`
			this.dragElementState.move = true

			// Check overlap element
			this.checkOverlap(this.dragElementState.cloneElement)

			// Cut and Overlays overlap element
			this.keyCapture('cut')
		},

		/**
		 * Drag is ended
		 * @param  {Event} e
		 * @return {void}
		 */
		dragElementEnd (e) {
			// Stop dragging
			utils.removeEvent(Viewer.window.document, 'mousemove', this.dragElementMove, false)
			utils.removeEvent(Viewer.window.document, 'mouseup', this.dragElementEnd, false)

			// If it's only click, not draggin, just select it
			if (this.dragElementState.x === e.pageX &&
				this.dragElementState.y === e.pageY) {
				this.dragElementState.element.$select()
			}

			// If it's dragging and move over other element
			// Not from source element, then paste it!
			let isDropping = this.dragElementState && this.dropElement
			if (isDropping) {
				let validDrop = this.dragElementState.element.$id !== this.dropElement.$id
				if (validDrop) {
					this.copyElement(this.dragElementState.element.$id, this.dropElement.$id)
					this.removeElement(this.dragElementState.element.$id)
				}
			}

			// Remove clone element
			this.notDraggingElement(this.dragElementState.cloneElement)

			// Reset drag state
			utils.resetObject(this.dragElementState)
		},

		/**
		 * Remove drag element and related data
		 * @param  {ElementNode} element
		 * @return {void}
		 */
		notDraggingElement (element) {
			if (element) {
				element.remove()
				this.overlapElement = null
				this.dragComponent = false
				this.componentClone = null
				this.dropElement = null
			}
		},

		/**
		 * Element on double clcik
		 * @param {Event} e
		 */
		dblclick (e) {
			let element = e.target

			if (! element.$selectable) {
				element = this.searchSelectableParent(element)
			}

			if (element) {
				if (element.$editable) {
					element.$edit(true)
				}

				if (element.parentElement.$editable) {
					element.parentElement.$edit(true)
				}
			}
		},

		/**
		 * Right click event, will show context menu
		 * @param  {Event} e
		 */
		rightclick (e) {
			if ((! e.target.$editable || ! this.editComponent) && e.target.$select) {
				e.preventDefault()

				// Select element
				e.target.$select(true)

				// Notify parent to show context menu
				this.canvasBuilder('contextMenu').setPosition({
					x: e.pageX,
					y: e.pageY
				})
			}
		},


		/**
		 * Update hover outline element
		 */
		tryHover () {
			if (this.hoverElement) {
				let element = this.getElement(this.hoverElement)
				if (element) {
					element.$hover()
				}
			}
		},

		/**
		 * Update hover outline element
		 * @param {Boolean} isRightclick
		 */
		trySelect (isRightclick) {
			if (this.activeElement) {
				let element = this.getElement(this.activeElement)
				if (element) {
					element.$select(isRightclick)
				}
			}
		},

		/**
		 * Get element by id
		 * @param  {String} id
		 * @return {Node}
		 */
		getElement (id, selectOriginal) {
			let selector = `[data-id="${id}"]`
			if (id === 'body') {
				selector = `[data-type="body"]`
			}

			let element = Viewer.window.document.querySelector(selector)
			if (element) {
				if (! selectOriginal) {
					element = element.$element()
				}

				return element
			}
		},

		/**
		 * Search selectable parent of element
		 * @param  {[type]} element [description]
		 * @return {[type]}         [description]
		 */
		searchSelectableParent (element) {
			if (element.parentElement) {
				if (element.parentElement.$selectable) {
					return element.parentElement
				}

				return this.searchSelectableParent(element.parentElement)
			}
		},

		/**
		 * Check is coords overlap with element
		 * @param  {ElementNode} elSrc
		 * @param  {ElementNode} elDst
		 * @return {Boolean}
		 */
		overlapWith (elSrc, elDst, callback) {
			if (elSrc.getBoundingClientRect && elDst.getBoundingClientRect) {
				let srcRect = elSrc.getBoundingClientRect(),
				dstRect = elDst.getBoundingClientRect()

				// Get coordinate of source element
				let x = parseInt(srcRect.left + (srcRect.width / 2)),
				y = parseInt(srcRect.top + (srcRect.height / 2))

				// If source element is inside of destination element
				const isInside = () => {
					return x >= dstRect.left && x <= dstRect.right && y >= dstRect.top && y <= dstRect.bottom
				}

				// If source element collide with inside top of destination element
				const collideInTop = () => {
					return y - dstRect.top <= 3 && y - dstRect.top >= 0
				}

				// If source element collide with outside top of destination element
				const collideOutTop = () => {
					return dstRect.top - y <= 3 && dstRect.top - y > 0
				}

				// If source element collide with inside bottom of destination element
				const collideInBottom = () => {
					return dstRect.bottom - y <= 3 && dstRect.bottom - y >= 0
				}

				// If source element collide with outside bottom of destination element
				const collideOutBottom = () => {
					return y - dstRect.bottom <= 3 && y - dstRect.bottom > 0
				}

				// If source element collide with inside left of destination element
				const collideInLeft = () => {
					return x - dstRect.left <= 3 && x - dstRect.left >= 0
				}

				// If source element collide with outside left of destination element
				const collideOutLeft = () => {
					return dstRect.left - x <= 3 && dstRect.left - x > 0
				}

				// If source element collide with inside right of destination element
				const collideInRight = () => {
					return dstRect.right - x <= 3 && dstRect.right - x >= 0
				}

				// If source element collide with outside right of destination element
				const collideOutRight = () => {
					return x - dstRect.right <= 3 && x - dstRect.right > 0
				}

				return {
					isInside,
					collideInTop, collideOutTop,
					collideInBottom, collideOutBottom,
					collideInLeft, collideOutLeft,
					collideInRight, collideOutRight
				}
			}
		},

		/**
		 * Check if source element is overlaping with elements
		 * @param {ElementNode} srcElement
		 */
		checkOverlap (srcElement) {
			for (let i in this.elements) {
				let element = this.getElement(this.elements[i].id)

				// Set overlap element with current collide element
				// No matters if it's collide or not we setup it first
				if (element) {
					this.overlapElement = element

					// Detect overlap elements
					let overlap = this.overlapWith(srcElement, element)

					// If it's overlap inside element
					if (overlap.isInside()) {
						// Set drop target with current element
						this.dropElement = element

						// Hover it
						this.overlapElement.$hover()

						// If element has no childs, dropin line is top
						// Otherwise check if its collide top or not
						let position = 'top'
						if (this.overlapElement.$childElements().length>0) {
							position = 'bottom'
						}

						// Set drop in line
						this.overlapElement.$dropIn(position)
					}
				}
			}
		},

		/**
		 * Parsing template markup
		 * @param {String} str
		 * @link https://github.com/djavaweb/unobuilder/wiki/Create-New-Uno-Component
		 */
		templateToElement (dropElement, template, nestedDeep) {
			// Parsing tag to node element
			template = $($.parseXML(template)).children()
			nestedDeep = nestedDeep || 0

			// Convert template markup to elements
			if (template.get(0))
			{
				let element = {attrs: {}, type: 'component', elements: []}

				// Get kind
				let kind = template.get(0).tagName
				element.kind = kind

				// Tag name for <element> and <wrapper>
				// @default 'div'
				let tagName = template.attr('tag') || 'div'
				template.removeAttr('tag')
				element.tag = tagName

				// Tag name for <element> and <wrapper>
				// @default 'div'
				let tagLabel = template.attr('label')
				template.removeAttr('label')
				if (tagLabel && tagLabel !== '') {
					element.label = tagLabel
				}

				// Reinitialize default value
				switch (kind) {
					case 'wrapper':
						element.wrapper = true
						element.selectable = false
					break

					case 'element':
						element.wrapper = false
						element.selectable = true
						element.dropable = 'section,container,row,column'
						element.attrs.class = utils.klass(`el-${tagName}`)
						element.props = {
							height: {
								value: 100,
								unit: '%'
							}
						}
					break

					case 'image':
						element.wrapper = false
						element.selectable = true
						element.dropable = 'section,container,row,column'
						element.attrs.class = utils.klass(`el-img`)
						element.tag = 'img'
						element.props = {
							background: {
								disabled: true
							}
						}
					break

					case 'content':
						element.wrapper = false
						element.selectable = true
						element.editable = true
						element.dropable = 'section,container,row,column'
						if (template.html().trim().length > 0) {
							element.html = _.escape(template.html().trim())
						}

						let inline = template.attr('inline')
						template.removeAttr('inline')
						if (inline) {
							element.attrs.class = utils.klass('inline')
						}

						element.props = {
							minHeight: {
								value: '',
								unit: 'px'
							}
						}
					break

					// Child is for internal wrapper
					// It has no documentation
					// Child only parse all attributes into props
					case 'child':
						element.type = 'child'

						let childKind = template.attr('kind')
						template.removeAttr('kind')
						if (childKind) {
							element.kind = childKind
						}

						let resizable = template.attr('resizable') || false
						template.removeAttr('resizable')
						element.resizable = JSON.parse(resizable)

						var props = template.attr('props')
						template.removeAttr('props')
						if (utils.isJSON(props)) {
							element.props = JSON.parse(props)
						}
					break

					case 'row':
						// Get gutter value
						let gutter = template.attr('gutter') || dropElement.$get('gutter.value'),
						klass = ['uk-grid', `uk-grid-${gutter}`, utils.klass('el-row')]
						template.removeAttr('gutter')

						// Default properties
						element.$klass = klass
						element.dropable = 'section,container,row,column'

						// Set row as wrapper
						element.row = true
						element.selectable = false

						// Remove tag other than <column>
						template.children(':not(column)').remove()

						// Set width to column
						let columns = template.children('column')
						columns.each((index, column) => {
							$(column).attr('totalColumn', columns.length)
						})
					break

					case 'column':
						// Get column grid value
						// @default 1
						let totalColumn = parseInt(template.attr('totalColumn'))
						template.removeAttr('totalColumn')

						// Get column width value
						// @default is 1 it's mean 100%
						let width = parseInt(template.attr('width'))

						if (! isNaN(width)) {
							width = width * 10
						} else {
							width = 100 / totalColumn
						}

						// Default properties
						element.attrs.class = `uk-width-1-${totalColumn} ${utils.klass('el-column-wrapper')}`
						element.dropable = 'section,container,row,column'

						// Set column as wrapper and unselectable element
						element.wrapper = true
						element.selectable = false

						var props = {}
						props.width = {
							value: width,
							unit: '%'
						}

						if (template.get(0).childNodes.length>0) {
							props.height = {value: 60, unit: 'px'}
						}

						// Since we're using uikit,
						// We must add wrapper to column
						// to avoid margin-left property
						props = JSON.stringify(props)
						template.wrapInner(`<child resizable="true" tag="div" kind="column" props='${props}'></child>`)
					break

					default:
						return null
					break
				}

				// Get attributes
				_.each(template.get(0).attributes, (attr, index) => {
					let attrValue = attr.value
					if (utils.isJSON(attrValue)) {
						attrValue = JSON.parse(attrValue)
					}

					element.attrs[attr.name] = attrValue
					//template.removeAttr(attr.name)
				})

				// If there is no attributes remove `attrs` object
				if (_.size(element.attrs) === 0) {
					delete element.attrs
				}

				// Get element children
				let elements = [],
				childNodes = template.get(0).childNodes,
				childLength = childNodes.length

				// Parsing child elements if any
				while (childLength--) {
					if (childNodes[childLength].nodeType === 1) {
						let template = this.templateToElement(dropElement, childNodes[childLength].outerHTML, nestedDeep + 1)
						if (template) {
							elements.unshift(template)
						}
					}
				}

				// Push to template object
				if (elements.length>0) {
					if (element.elements>0) {
						element.elements[0].elements = elements
					} else {
						element.elements = elements
					}
				}

				return element
			}
		},

		/**
		 * element on hover by Id
		 * @param  {Object} breadcrumb
		 */
		elementHover (breadcrumb) {
			let element = this.getElement(breadcrumb.id)
			element.$hover()
		},

		/**
		 * Element on click by Id
		 * @param  {Object} breadcrumb
		 */
		elementSelect (breadcrumb) {
			let element = this.getElement(breadcrumb.id)
			element.$select()
		},

		/**
		 * On adding block
		 * @param {ElementNode} element
		 * @param {Number} index
		 */
		addBlock (element, index) {
			// Exeptions for body
			if (element.append === 'body') {
				element.append = '[data-type="body"]'
			}

			// Override attribute
			this.createElement(element, index, el => {
				el.$select()
			})
		},

		/**
		 * Copy element by id
		 * @param {String} id
		 * @param {String} dstId
		 * @param {Boolean} sameCopy
		 * @return {}
		 */
		copyElement (id, dstId, sameCopy) {
			id = id || this.activeElement

			let el = this.getElement(id)
			let copyEl = el.$elementWrapper()
			let pasteEl = el.$parentElement().$id

			if (dstId) {
				pasteEl = dstId
			}

			copyEl.$copy(pasteEl, () => {
				// if (sameCopy) {
				// 	this.copyElement()
				// }
			})
		},

		/**
		 * Remove element by id
		 * @param  {String} id
		 */
		removeElement (id) {
			id = id || this.activeElement

			let el = this.getElement(id),
			removeEl = el.$elementWrapper()

			// Prevent delete of body element
			if (removeEl.$kind && removeEl.$kind !== 'body') {

				// Get element sibling
				let sibling = removeEl.$sibling()

				// Set hover element
				if (this.hoverElement === removeEl.$id || this.hoverElement === el.$id) {
					this.hoverElement = sibling.$id
				}

				// If parent element is a row element
				// Remove it, but if it has a children, cancel.
				let parent = removeEl.parentElement

				// Remove attributes and element
				removeEl.$remove()

				// Update elements style
				this.updateStylesheet()

				// After remove, select parent element immediately
				this.$nextTick(() => {
					// If a row element has no children
					// Remove it
					if (parent && parent.$row) {
						let childs = parent.$childElements()
						if (childs.length===0) {
							this.removeElement(parent.$id)
						} else {
							this.tryHover()
							sibling.$select()
						}
					} else {
						this.tryHover()
						sibling.$select()
					}

					parent.$updateEmptiness()
				})
			}
		},

		/**
		 *  On screen size change
		 */
		setScreenSize (size) {
			this.screenSize = size
			this.updateStylesheet(true)
		},

		/**
		 * Notify element has change, update stylesheet
		 * @param {Boolean} reselect
		 */
		updateStylesheet (reselectEl) {
			this.$refs.cssRenderer.updateStylesheet()

			// Reselect element
			if (reselectEl) {
				this.$nextTick(() => {
					this.tryHover()
					this.trySelect()
				})
			}
		},

		/**
		 * Save custom CSS
		 * @param  {String} css
		 */
		saveCSS (css) {
			this.customCSS = css
			this.updateStylesheet(true)
		},

		/**
		 * On keyboard event binding
		 * @param {String} action
		 * @param {Boolean} isHoveredElement
		 */
		keyCapture (action, isHoveredElement) {
			let activeElement

			// Prevent to copy and remove of body element
			if (this.activeElement && this.activeElement !== 'body') {
				activeElement = this.getElement(this.activeElement)
			}

			switch (action) {
				case 'copy':
					// When user copy element, we set copy element to
					// copiedElement variable, will be used in paste
					this.copiedElement = this.activeElement
				break

				case 'cut':
					// Same with copy
					this.copiedElement = this.activeElement
					this.cuttingElement = true
					let overlayElement = this.getElement(this.activeElement)
					if (overlayElement) {
						overlayElement.$element().$overlay()
					}
				break

				case 'paste':
					// Prevent to copy body element, skip it
					if (this.copiedElement && this.copiedElement !== 'body') {
						let copyElement = this.getElement(this.copiedElement)

						if (copyElement) {
							let copyParentId = copyElement.$parentElement().$id,
							pasteElement = activeElement.$id, sameCopy

							// If active element has parent element such as container
							let parentElement = activeElement.$parentElement()
							if (parentElement) {
								// If it's a row element
								// After paste, copy again current element
								if (parentElement.$row) {
									sameCopy = true
								} else {
									// set destination element as parent of parent
									let activeParentId = parentElement.$id

									if (copyParentId === activeParentId) {
										pasteElement = copyParentId
									}
								}
							}

							// If copy element is the same with active element
							// set destination element as parent
							if (copyElement.$id === activeElement.$id) {
								pasteElement = copyParentId
							}

							// If copy element is column
							// And paste element is container or anything that has row
							// Set paste element as row
							if (copyElement.$kind === 'column') {
								let firstChild = this.getElement(pasteElement).firstChild
								if (firstChild && firstChild.$kind === 'row') {
									pasteElement = firstChild.$id
								}
							}

							// Okay, copy that!
							this.copyElement(copyElement.$id, pasteElement, sameCopy)

							// If it's cut, just remove original element
							if (this.cuttingElement) {
								this.$nextTick(() => {
									this.removeElement(copyElement.$id)
									this.cuttingElement = false
								})
							}
						}
					}
				break

				case 'delete':
					if (activeElement) {
						this.removeElement(activeElement.$id)
					}
				break

				case 'selectUp':
					if (activeElement) {
						// Get previous element
						let prevEl = activeElement.$prev()

						// if active element position is at 1st, we can't move
						// to up anymore, so we move to parent element
						if (! prevEl) {
							prevEl = activeElement.$parentElement()
						}

						if (prevEl) {
							prevEl.$hover()
							prevEl.$select()
						}
					}
				break

				case 'selectDown':
					if (activeElement) {
						// Get next element
						let nextEl = activeElement.$next()

						// if active element position is at the end, we can't move
						// to down anymore, so we move to parent element
						if (! nextEl) {
							nextEl = activeElement.$parentElement()
						}

						if (nextEl) {
							nextEl.$hover()
							nextEl.$select()
						}
					}
				break

				case 'enter':
					if (this.activeElement) {
						// Get active element and it's child
						let activeElement = this.getElement(this.activeElement),
						firstChild = activeElement.firstChild

						// If first element is valid element, here we go!!
						if (firstChild && firstChild.$element) {
							firstChild.$element().$select()
						}
					}
				break

				case 'esc':
					this.builder().closeAllPanels()
				break

				case 'copyStyle':
				break

				case 'pasteStyle':
				break

				case 'clearStyle':
				break
			}
		},

		/**
		 * Drag a component
		 * @param {ElementNode} element
		 * @param {Object} component
		 */
		dragComponentStart (element, component) {
			// Dragigng
			this.dragComponent = true

			// Set style of cloned element
			this.componentElement = element
			this.componentElement.className = [utils.klass('component'), utils.klass('component--dragging')].join(' ')
			Viewer.window.document.body.appendChild(this.componentElement)
		},

		/**
		 * Moving component
		 * @param {Object} coords
		 */
		dragComponentMove (coords) {
			let layout = this.getElement('body')
			if (layout) {
				// Get component offset
				let componentRect = this.componentElement.getBoundingClientRect(),
				width = componentRect.width,
				height = componentRect.height,
				bodyRect = Viewer.window.document.body.getBoundingClientRect()

				// Get x and y coords inside canvas
				let x = parseInt((coords.x - (width / 2)) - this.canvasBuilder().leftSpace()),
					y = parseInt((coords.y - (height / 2)) - this.canvasBuilder().positionFromTop())

				// Follow the original component position
				this.componentElement.style.left = `${x}px`
				this.componentElement.style.top = `${y}px`

				// Check overlap element
				this.checkOverlap(this.componentElement)
			}
		},

		/**
		 * Dragging component is over
		 * @param {Object} component
		 */
		dragComponentEnd (component) {
			if (this.dropElement) {
				// Parse markup into object
				let element = this.templateToElement(this.dropElement, component.template)

				// Change kind
				if (component.settings.kind) {
					element.kind = component.settings.kind
				}

				// Options
				if (component.settings.options) {
					element.options = component.settings.options
				}

				// Create element
				if (this.dropElement.$accepting(element.dropable)) {
					this.dropElement.$element().$add(element, (el) => {
						_.each(component.settings.props, (val, key) => {
							el.$set(key, val)
						})
						el.$select()
					})
				}
			}

			this.overlapElement.$dropOut()
			this.notDraggingElement(this.componentElement)
		},

		/**
		 * Set row gutter
		 * @param {String} size
		 */
		setGutter (size, mouseState = '') {
			let element = this.getElement(this.activeElement)
			if (element) {
				element.$set('gutter.value', size, mouseState)

				let childs = element.$childElements()
				for (let i in childs) {
					if (childs[i].$kind && childs[i].$kind === 'row') {
						let gridKlass = _.chain(childs[i].classList)
						.map(item => item.indexOf('uk-grid-')>-1)
						.value().indexOf(true)

						//.map(item => item.indexOf('uk-grid-'))
						if (gridKlass>-1) {
							childs[i].$removeKlass(childs[i].classList[gridKlass], true)
							childs[i].$addKlass(`uk-grid-${size}`, true)
							childs[i].$renderKlass()
						}
					}
				}
			}
		},

		/**
		 * Disable editor
		 */
		applyEditor (state) {
			let doc = Viewer.window.document
			if (! state) {
				let editableElement = doc.querySelectorAll('[contenteditable]')
				utils.removeEvent(doc, 'input', this.editingContent)
				utils.removeEvent(doc, 'paste', this.pasteContent)
				for (let el in editableElement) {
					if (editableElement[el].$editable) {
						editableElement[el].setAttribute('contenteditable', false)
						editableElement[el].$edit(false)
					}
				}
			} else {
				let element = this.getElement(state.id)
				if (element) {
					utils.addEvent(doc, 'input', this.editingContent)
					utils.addEvent(doc, 'paste', this.pasteContent)
					element.setAttribute('contenteditable', state.editable)
				}
			}
		},

		editingContent () {
			this.trySelect()
			this.canvasBuilder('elementSelector').textEditorReposition()
		},

		pasteContent (e) {
			e.preventDefault();
			let doc = Viewer.window.document
			let text = ''
			if (e.clipboardData || e.originalEvent.clipboardData) {
			  text = (e.originalEvent || e).clipboardData.getData('text/plain')
			} else if (Viewer.window.clipboardData) {
			  text = Viewer.window.clipboardData.getData('Text');
			}
			if (doc.queryCommandSupported('insertText')) {
			  doc.execCommand('insertText', false, text);
			} else {
			  doc.execCommand('paste', false, text);
			}
			this.editingContent(e)
		}
  },

	/**
	 * Event list
	 * @type {Object}
	 */
    events: {
        addCSS () {},
    },

    ready () {
		/**
		 * When window resize reselect element
		 * @return {void}
		 */
		Viewer.window.addEventListener('resize', () => {
			this.tryHover()
			this.trySelect()
		})

        /**
         * Create body
         */
        this.createElement({
            append: Viewer.element,
            tag: 'div',
            type: 'body',
            kind: 'body',
						label: (Viewer.element === 'body')? undefined: 'layout'
        }, (el) => {
			el.$set('display.disabled', true)
	        el.$select()
		})

		// Copy element
		Mousetrap(Viewer.window.document.body).bind(['ctrl+x', 'command+x'], (e) => {
			if (! this.editContent) {
				e.preventDefault()
				this.keyCapture('cut')
			}
		})

		// Copy element
		Mousetrap(Viewer.window.document.body).bind(['ctrl+c', 'command+c'], (e) => {
			if (! this.editContent) {
				e.preventDefault()
				this.keyCapture('copy')
			}
		})

		// Paste element
		Mousetrap(Viewer.window.document.body).bind(['ctrl+v', 'command+v'], (e) => {
			if (! this.editContent) {
				e.preventDefault()
				this.keyCapture('paste')
			}
		})

		// Delete element
		Mousetrap(Viewer.window.document.body).bind('del', (e) => {
			if (! this.editContent) {
				e.preventDefault()
				this.keyCapture('delete')
			}
		})

		// Copy element style
		Mousetrap(Viewer.window.document.body).bind(['ctrl+shift+c', 'command+shift+c'], (e) => {
			if (! this.editContent) {
				e.preventDefault()
				this.keyCapture('copyStyle')
			}
		})

		// Paste element style
		Mousetrap(Viewer.window.document.body).bind(['ctrl+shift+v', 'command+shift+v'], (e) => {
			if (! this.editContent) {
				e.preventDefault()
				this.keyCapture('pasteStyle')
			}
		})

		// Clear element style
		Mousetrap(Viewer.window.document.body).bind(['ctrl+shift+del', 'command+shift+del'], (e) => {
			e.preventDefault()
			this.keyCapture('clearStyle')
		})

		// Select using left and up
		Mousetrap(Viewer.window.document.body).bind(['left', 'up'], (e) => {
			if (! this.editContent) {
				e.preventDefault()
				this.keyCapture('selectUp')
			}
		})

		// Select using right and down
		Mousetrap(Viewer.window.document.body).bind(['right', 'down'], (e) => {
			if (! this.editContent) {
				e.preventDefault()
				this.keyCapture('selectDown')
			}
		})

		// Select childs using space
		Mousetrap(Viewer.window.document.body).bind(['space', 'enter'], (e) => {
			if (! this.editContent) {
				e.preventDefault()
				this.keyCapture('enter')
			}
		})

		// Detect shift keydown/keyup
		// Mousetrap(Viewer.window.document.body).bind('shift', () => {
		// 	this.builder().$broadcast('keyCapture', 'pressShift')
		// })
        // Mousetrap(Viewer.window.document.body).bind('shift', () => {
		// 	this.builder().$broadcast('keyCapture', 'releaseShift')
		// }, 'keyup')
    }
}

module.exports = Viewer