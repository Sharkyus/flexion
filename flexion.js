(function($) {
	$.fn['flexion'] = function(options) {
		if (typeof options == 'string') {
			var method = options;
			return $.fn['flexion'][method](this);
		}

		options = options || {};
		this.type =		'fit'; //border, vert, hor, anchor, card, 
		this.width = 	this.width() 	|| options.width;
		this.height = 	this.height() 	|| options.height;
		this.items = 	null 			|| options.items;
		this.verAlign = 0				|| options.verAlign;
		this.horAlign = 0				|| options.horAlign;

		this.init = function(options) {
			if (!$.fn['flexion'].map) $.fn['flexion'].map = {};
			var cmp = $.fn['flexion'].get(this);

			if (!cmp) {
				this.initLayout(options);
			} else {

			}
		};

		this.initLayout = function(options) {
			var layout = new Layout(this, options);
			if (options.width)  this.css('width',  options.width );
			if (options.height) this.css('height', options.height);
			//var items = this.initItems(layout.items);
			//layout.add(options.items);
		};

		/*this.initItems = function(items) {
			for (var i in items) {
				var layout = items[i];
				layout = this.createComponent(layout);
				if (layout.items) {
					var it = this.initItems(layout.items);
					layout.add(it, {silent: true});
				}
				items[i] = layout;
			}
			return items; 
		};*/

		/*this.createComponent = function(options) {
			var layout = new Layout(this, options);
			return layout;
		};*/

		this.getComponent = function() {
		};

		this.init(options);
	}

	$.fn['flexion'].get = function(el) {
		var cmpId = el.attr('data-layoutid');

		if (!cmpId) {
			cmpId = el.find('> div[data-layoutid]').attr('data-layoutid');	
		}
		if (!cmpId) return null;
		return $.fn['flexion'].map[cmpId]; 	
	};

	$.fn['flexion'].doLayout = function(options) {
		for (var i in $.fn['flexion'].map) {
			var item = $.fn['flexion'].map[i];
			if (!item._detached) {
				item.doLayout(options);
			} 		
		}
	};

	$(window).on('resize', function(e){
		clearTimeout(this.timer);
		this.timer = setTimeout(function(){
			$.fn['flexion'].doLayout({notChaining: true, onlyLayout: true});
		},10)
	});

	var Layout = function(el, options) {
		options = options || {};
		this.customId = (options.id) ? true : false;
		options.id = options.id || Layout.genId();

		this.isLayout = true;
		this.type = Layout.TYPE.HORIZONTAL;
		this.sizeType = null;
		this.sizesMap = null; 
		this.sizesTyped = null; 
		this._allFixedSummary = 0;
		this._allDynamicSummary = 0;
		this._allPercentsSummary = 0;
		this._allFlexSummary = 0;
		this.anchor = 0;

		jQuery.extend(this, options);

		this.on = function(eventName, handler, scope) {
		    if (!this._eventHandlers) this._eventHandlers = [];
		    if (!this._eventHandlers[eventName]) {
		      	this._eventHandlers[eventName] = [];
		    }
		    this._eventHandlers[eventName].push([handler, scope]);
		},

		this.once = function(eventName, handler, scope) {
			if (!this._eventHandlers) this._eventHandlers = [];
			var handlers = this._eventHandlers[eventName];

			if (handlers) {
				for(var i=0; i<handlers.length; i++) {
			      	if (handlers[i][0] == handler) {
			      		return;
			      	}
			    }	
			} else {
				this.on(eventName, handler, scope);
			}
		},

		this.off = function(eventName, handler, scope) {
			var handlers = this._eventHandlers[eventName];
			if (!handlers) return;
			for(var i=0; i<handlers.length; i++) {
			  	if (handlers[i][0] == handler) {
			    	handlers.splice(i--, 1);
			  	}
			}
		},

		this.trigger = function(eventName) {
			if (!this._eventHandlers[eventName]) {
			  	return; // обработчиков для события нет
			}

			// вызвать обработчики 
			var handlers = this._eventHandlers[eventName];
			for (var i = 0; i < handlers.length; i++) {
			 	handlers[i][0].apply(handlers[i][1] || this, [].slice.call(arguments, 1));
			}
		}
		
		this.setLayout = function(type) {
			this.type = type || this.type || Layout.TYPE.VERTICAL;
			this.setVerticalMethod(this.type);
			this.setHorizontalMethod(this.type);
		};
		
		this.getEl = function() {
			if (!this.el) {
				this.el = $(document.createElement('div'));
				this.el.append(this.items ? '' : this.html);
				if (this.className) this.el.addClass(this.className); 
				this.el.attr('data-layoutId', this.id);
				if (this.customId) {this.el.attr('id', this.id);}
				this.el.css({
					position: 'absolute',
					height: this.height,
					width: this.width
				});
			} 

			return this.el;
		};

		this.doLayout = function(options) {
			//// console.log('    %cdoLayout -- ' + this.className, 'background: #FFC107', options);
			options = options || {};
			if (!options.onlyLayout) {
				if (this._constructed && this.parent && (this.sizeType == Layout.SIZE.DYNAMIC || this.isPercentItemInDynamicLayout() || this.isFlexItemInDynamicLayout()) && !options.chainCall) {			
					this.parent.doLayout(options);
					return;
				}

				if (!this.items || this._detached) return;
				if (!options.withoutResize) {
					this.distributeSizes(options);
					if (this.isDynamic() && !options.chainCall) {
						this.resizeDynamicContainer();
					}
				}
			}

			this.calculateHorizontal();
			this.calculateVertical();

			if (options.notChaining) return;

			for (var i in this.items) {
				var item = this.items[i]; 
				if (item._constructed) {
					item.doLayout({withoutResize: options.withoutResize, chainCall: true});
				}
			}
		};

		this.resizeDynamicContainer = function() {
			//// console.log('    %cresizeDynamicContainer -- ' + this.className, 'background: #FFC107');
			var width = 0; 	for (var i in this.sizesMap['fixed']) {
								width += this.sizesMap['fixed'][i];
								//// console.log('      %c' + this.itemsMap['fixed'][i].className + ' fixed container width increment on ' + this.sizesMap['fixed'][i] + 'px' + '|| width = ' + width + 'px', 'background: #FFCC80');	
							}
							for (var i in this.sizesMap['dynamic']) {
								width += this.sizesMap['dynamic'][i];
								//// console.log('      %c' + this.itemsMap['dynamic'][i].className + ' dynamic container width increment on ' + this.sizesMap['dynamic'][i] + 'px' + ' || width = ' + width + 'px', 'background: #FFCC80');	
							}
							for (var i in this.sizesMap['perc']) { 
								var item = this.itemsMap['perc'][i];
								width += this.itemsMap['perc'][i].getEl().width();
								//// console.log('      %c' + this.itemsMap['perc'][i].className + ' percent container width increment on ' + this.itemsMap['perc'][i].getEl().width() + 'px' + ' || width = ' + width + 'px', 'background: #FFCC80');
							}
							for (var i in this.sizesMap['flex']) { 
								var item = this.itemsMap['flex'][i];
								width += this.itemsMap['flex'][i].getEl().width();
								//// console.log('      %c' + this.itemsMap['flex'][i].className + ' flex container width increment on ' + this.itemsMap['flex'][i].getEl().width() + 'px' + ' || width = ' + width + 'px', 'background: #FFCC80');
							}
			
			
			this.getEl().css('width', width + 'px');	
			//// console.log('        %c' + this.className + ' container || width = ' + this.getEl().width() + 'px', 'background: #FFCC80');						
		};

		//other layouts or html
		this.add = function(items, options) {
			//// console.log('    add -- ' + this.className);
			if (!items || ($.isArray(items) && !items.length)) return;
			this.clearData();
			options = options || {};
			items = $.isArray(items) ? items : [items];
			this.items = items;	
			for (var i in this.items) {
				var item = this.items[i];
				if(!item.isLayout) {
					item.parent = this;
					item = new Layout(this.getEl(), item);
				} else {
					item.parent = this;
					item.reinit(this.getEl());
				}

				if (!this._constructed && this.parent && !this.parent.isFlex() && this.isFlex() && item.isFlex()) {
					this.parent._doLayoutAfterInit = true;
				}
				this.items[i] = item;

				//this.distribute(item);
			};
			//this.calculateAllFlex(this.items);

			if (this._detached) return; 

			this.doLayout(options);
		};

		this.isParentHorizontal = function() { return this.parent && this.parent.type == Layout.TYPE.HORIZONTAL; };
		this.isParentVertical = function()   { return this.parent && this.parent.type == Layout.TYPE.VERTICAL;	 };

		this.isDynamic = function() { return this.sizeType == Layout.SIZE.DYNAMIC;	};
		this.isFlex    = function() { return this.sizeType == Layout.SIZE.FLEX;     };
		this.isFixed   = function() { return this.sizeType == Layout.SIZE.FIXED;    };
		this.isPercent = function() { return this.sizeType == Layout.SIZE.PERCENT;  };

		this.distributeSizes = function(options) {

			//// console.log('    %cdistribute_sizes -- ' + this.className, 'background: wheat');
			options = options || {};
			this.clearData();

			/*if (this.isParentHorizontal() && (this.isDynamic() || this.isFlex())) {
				this.getEl().css({ width: ''  })

				console.log('    %cset width -- ' + (this.getEl().width()  + 1) + 'px -- ' + this.className, 'background: #2196F3; color: white');
				this.getEl().css({ width:  this.getEl().width()  + 1 });
			}
			if (this.isParentVertical()   && (this.isDynamic() || this.isFlex())) {
				this.getEl().css({ height: '' }).css({ height: this.getEl().height() + 1 });
			}*/
			this.calculateAllFlex(this.items);
			for (var i in this.items) {
				var item = this.items[i]; 

				item.updateVisibility();
				if (!item.getEl().is(':visible')/* || item.isFixed()*/) {
					this.itemsMap['fixed'].push(item);
					this.sizesMap['fixed'].push(0);
					this.calcMap.push([0, 0]);
					continue;
				} 
				if (!options.notChaining) {
					if (item.isLayout) {
						item.distributeSizes();
					}
				}
				
				this.distribute(item, options);
				if (this.isDynamic()) {
					this.resizeDynamicContainer();
				}
			}
		};

		this.updateVisibility = function() {
			this.getEl().css('display', 'block');
			if (!this.getEl().children().length) return;
			if (!this.getEl().find('>:visible').length) {
				this.getEl().css('display', 'none');	
			}

			/*if (!this.getEl().children().length) return;
			if (this.getEl().find('>:visible').length) {
				this.getEl().css('display', 'block');
			} else {
				this.getEl().css('display', 'none');
			}*/
		};

		this.clearData = function() {
			this._allFixedSummary = 0;
			this._allDynamicSummary = 0;
			this._allPercentsSummary = 0;
			this._allFlexSummary = 0;
			this._allPaddings = 0;
			this._allMargins = 0;
			this._allBorders = 0;

			this.sizesMap = {
				flex: [],
				perc: [],
				fixed: [],
				dynamic: []
			}; 
			this.itemsMap = {
				flex: [],
				perc: [],
				fixed: [],
				dynamic: []
			}; 

			this.calcMap = [];
		}

		this.calculateAllFlex = function(items) {
			for (var i in items) {
				var item = items[i];
				if (item.flex && item.getEl().is(':visible'))
					this._allFlexSummary += item.flex;
			}
		};

		this.getAnchorValue = function(v) {
			switch (v) {
				case 'start':  return Layout.ANCHOR.START;
				case 'center': return Layout.ANCHOR.CENTER;
				case 'end':    return LAYOUT.ANCHOR.END
				default: 	   return v;
			}
		};

		this.getHeight = function() {
			return this.height || this.getEl().height();
		};

		this.setHeight = function(v) {
			this.height = v;
			this.getEl().css({height: v});		
		};
		this.setWidth = function(v) {
			this.width = v;
			this.getEl().css({width: v});		
		};

		this.isHeightFixed = function() { return this._heightFixed; };
		this.isWidthFixed = function()  { return this._widthFixed;  };

		this.isPercentItemInDynamicLayout = function(item) {
			return this.parent && this.parent.isDynamic() && this.sizeType == Layout.SIZE.PERCENT;
		};

		this.isFlexItemInDynamicLayout = function(item) {
			return this.parent && this.parent.isFlex() && this.sizeType == Layout.SIZE.PERCENT;
		};

		this.setHorizontalMethod = function(type) {
			switch(type) {
				case Layout.TYPE.VERTICAL: {
					this.distribute = function(item) {
						
						if (!(item.height || item.flex)) {
							this.sizesMap['dynamic'].push(item);	
							var height = item.getEl().height();
							this.calcMap.push([height, Layout.SIZE.DYNAMIC]);
							this._allFixedSummary += height;

							if (this.sizeType == Layout.SIZE.DYNAMIC) {
								this._allDynamicSummary += height;
								this.getEl().css('height', this._allFixedSummary + 'px');
							}
							return;
						} else if (item.height && (typeof item.height == 'number' || item.height.toString().match('px'))) {
							this.sizesMap['fixed'].push(item);
							var height = parseInt(item.height);
							this.calcMap.push([height, Layout.SIZE.FIXED]);
							this._allFixedSummary += height;
							return;	
						} else if (item.height) {
							this.sizesMap['perc'].push(item);
							var height = parseInt(item.height);
							this.calcMap.push([height, Layout.SIZE.PERCENT]);
							this._allPercentsSummary += height;
							return;
						}
						if (item.flex) {
							this.sizesMap['flex'].push(item);
							this.calcMap.push([parseFloat((1 - ((this._allFlexSummary - item.flex)/this._allFlexSummary)).toFixed(5)), Layout.SIZE.FLEX]);
							
							return;
						}
					};

					this.calculateHorizontal = function(items) {
						var cntWidth = this.getEl().width() * this.anchor;	

						for (var i in this.items) {
							var item = this.items[i];
						    if (!this.isWidthFixed() && (item.getEl().width() > this.getEl().width())) {
								this.setWidth(item.width || item.getEl().width());
							}
						    item.getEl().css({
						    	left: cntWidth - item.getEl().width() * this.anchor + 'px'
						    });
						}
					}
					break;
				}
				case Layout.TYPE.HORIZONTAL: {
					this.distribute = function(item, options) {
							var paddings = {
								lr: parseInt(item.getEl().css('padding-left')) + parseInt(item.getEl().css('padding-right')),
								tb: parseInt(item.getEl().css('padding-top')) + parseInt(item.getEl().css('padding-bottom')),
							};
							var margins = {
								lr: parseInt(item.getEl().css('margin-left')) + parseInt(item.getEl().css('margin-right')),
								tb: parseInt(item.getEl().css('margin-top')) + parseInt(item.getEl().css('margin-bottom')),								
							}
							var borders = {
								lr: parseInt(item.getEl().css('border-left-width')) + parseInt(item.getEl().css('border-right-width')),
								tb: parseInt(item.getEl().css('border-top-width')) + parseInt(item.getEl().css('border-bottom-width')),								
							}
							this._allPaddings += paddings.lr;
							this._allMargins += margins.lr;
							this._allBorders += borders.lr;
						//// console.log('        %cdistribute -- ' + this.className + ' ' + item.className, 'background: #43A047; color: white');
						if (!(item.width || item.flex) || item.isPercentItemInDynamicLayout() || item.isFlexItemInDynamicLayout()) {
							// if ((item.isPercent() || this.isDynamic()) /*|| (this.isDynamic && options.chainCall)*/) {
							// 	item.getEl().css('width', '');
							// 	console.log(['11111111111111111111111'])
							// }

							if (!item.items) {
								item.getEl().css('position', 'fixed');
								item.getEl().css('width', '');
							}
							this.itemsMap['dynamic'].push(item);	
							var width = item.getEl().width();
							item.getEl().css('position', 'absolute');

							this.sizesMap['dynamic'].push(width);
							this.calcMap.push([width, Layout.SIZE.DYNAMIC, paddings.lr, margins.lr, borders.lr]);
							
							this._allFixedSummary += width;
							return;
						} else if (item.width && (typeof item.width == 'number' || item.width.toString().match('px'))) {
							this.itemsMap['fixed'].push(item);
							var width = parseInt(item.width);
							//// console.log('            %cFIXED -- || width = ' + width + 'px', 'color: white; background: #212121');
							this.calcMap.push([width, Layout.SIZE.FIXED, paddings.lr, margins.lr, borders.lr]);
							this.sizesMap['fixed'].push(width);
							this._allFixedSummary += width;
							return;	
						} else if (item.width) {
							this.itemsMap['fixed'].push(item);
							this.itemsMap['perc'].push(item);
							//// console.log('            %cPERCENTS -- || width = ' + item.width, 'color: white; background: #212121');
							var width = parseInt(item.width);
							this.calcMap.push([width, Layout.SIZE.PERCENT, paddings.lr, margins.lr, borders.lr]);
							this.sizesMap['perc'].push(width);
							this._allPercentsSummary += width;
							return;
						}
						if (item.flex) {
							this.itemsMap['flex'].push(item);
							item.sizeType = Layout.SIZE.PERCENT;
							var size = parseFloat((1 - ((this._allFlexSummary - item.flex)/this._allFlexSummary)).toFixed(10));
							//// console.log('            %cFLEX -- || flex size = ' + size, 'color: white; background: #212121');
							this.calcMap.push([size, Layout.SIZE.FLEX, paddings.lr, margins.lr, borders.lr]);	
							this.sizesMap['flex'].push(size);					
							return;
						}
					};

					this.calculateHorizontal = function() {
						var cntWidth = this.getEl().width();

						var calcWidth = this._allFixedSummary + this._allPercentsSummary/100 * cntWidth;
						var horAnchor = 0;
						var flexWidth = cntWidth - calcWidth - this._allMargins - this._allPaddings - this._allBorders;
						for (var i in this.items) {
							var item = this.items[i],
								wVal = this.calcMap[i][0],
								wType = this.calcMap[i][1] == 1 ? '%' : 'px';
							if (this.calcMap[i][1] == Layout.SIZE.FLEX && flexWidth > 0) wVal *= flexWidth;

							if (wVal == 0) continue;


							//console.log('	%ccalculate -- ' + this.calcMap[i][1] + ' ' + item.className + ' in ' + this.className + ' || '+ 'width = ' + (wVal + wType) + '; left = ' + (horAnchor + 'px'), 'color: white; background: #2196F3');
							item.getEl().css({
								width: wVal + wType,
								left: horAnchor + 'px'
							});

							if (this.calcMap[i][1] == Layout.SIZE.PERCENT) {
								wVal *= cntWidth/100;
							}

							horAnchor += wVal + this.calcMap[i][2] + this.calcMap[i][3]  + this.calcMap[i][4];
						}


						//// console.log('    %cSummary container (' + this.className + ') width = ' + this.getEl().width() + 'px', 'color: black; background: #FFAB91');
					};
					break;
				}
				case Layout.TYPE.ANCHOR: {
					this.calculateHorizontal = function() {
		
					}
				}
			}
		};

		this.setVerticalMethod = function(type) {
			switch(type) {
				case Layout.TYPE.VERTICAL: {
					this.calculateVertical = function() {
						var cntHeight = this.getEl().height();

						var calcHeight = this._allFixedSummary + this._allPercentsSummary/100 * cntHeight;
						var verAnchor = 0;
						var flexHeight = cntHeight - calcHeight;
						for (var i in this.items) {
							var item = this.items[i],
								wVal = this.calcMap[i][0],
								wType = this.calcMap[i][1] == 1 ? '%' : 'px';
							if (this.calcMap[i][1] == Layout.SIZE.FLEX && flexHeight > 0) wVal *= flexHeight;

							if (wVal == 0) continue;

							item.getEl().css({
								height: wVal + wType,
								top: verAnchor + 'px'
							});

							if (this.calcMap[i][1] == Layout.SIZE.PERCENT) {
								wVal *= cntHeight/100;
							}

							verAnchor += wVal;
						}
					}
					break;
				}
				case Layout.TYPE.HORIZONTAL: {
					this.calculateVertical = function() {
						var cntHeight = this.getEl().height() * this.anchor;	

						for (var i in this.items) {
							var item = this.items[i];
						    if (!this.isHeightFixed() && (item.getEl().height() > this.getEl().height())) {
								this.setHeight(item.height || item.getEl().height());
							}
						    item.getEl().css({
						    	top: cntHeight - item.getEl().height() * this.anchor + 'px'
						    });
						}
					}
					break;
				}
				case Layout.TYPE.ANCHOR: {
					this.calculateVertical = function() {
		
					}
				}
			}
		}

		return this.constructor(el, options);
	}

	Layout.prototype.constructor = function(el, options) {
		//// console.log('%cinit ' + this.className, "background: grey; border-radius: 2px; color: white;");
		
		if (!this._inited)  {
			this.initialize();
			this._inited = true;
		}

		if (!el) {
			this._options = options;
			this._detached = true;
			return;
		}
		this.anchor = this.getAnchorValue(this.anchor);

		this.sizesMap = {
			flex: [],
			perc: [],
			fixed: [],
			dynamic: []
		};
		this.itemsMap = {
			flex: [],
			perc: [],
			fixed: [],
			dynamic: []
		};

		this.calcMap = [];
		this.setLayout();
		if (!$.fn['flexion'].map) $.fn['flexion'].map = {};
		$.fn['flexion'].map[this.id] = this;

		if (el) {
			var v = this.getEl();
			$(el).append(v);
			if (this.isParentHorizontal()) {
				if (!(this.width || this.flex)) {
					this.sizeType = Layout.SIZE.DYNAMIC;
					this.getEl().css({
						position: 'fixed'
					});
					var w = this.getEl().width() + 'px';
					var h = this.getEl().height() + 'px';

					this.getEl().css({
						position: 'absolute'
					});
					this.getEl().css({
						width: w,
						height: h
					});
				}
			}
			if (this.isParentVertical()) {
				if (!(this.height || this.flex)) {
					this.sizeType = Layout.SIZE.DYNAMIC;
					this.getEl().css({
						position: 'fixed'
					});
					var w = this.getEl().width() + 'px';
					var h = this.getEl().height() + 'px';

					this.getEl().css({
						position: 'absolute'
					});
					this.getEl().css({
						width: w,
						height: h
					});
				}
			}
			

			//console.log($(this.getEl()).width(), $(this.getEl()).attr('style'), 'add ', this.className, ' to ', $(el).width(), el, $(el).attr('style'));
			

			this._detached = false;
		} else this._detached = true;

		if (this.parent && this.parent.type == Layout.TYPE.HORIZONTAL && this.width) {
			if (this.width && (typeof this.width == 'number' || this.width.toString().match('px'))) {
				this.sizeType = Layout.SIZE.FIXED;		
			} else if (this.width) {
				this.sizeType = Layout.SIZE.PERCENT;
			}
		} else if (this.parent && this.parent.type == Layout.TYPE.VERTICAL && this.height) {
			if (this.height && (typeof this.height == 'number' || this.height.toString().match('px'))) {
				this.sizeType = Layout.SIZE.FIXED;
			} else if (this.height) {
				this.sizeType = Layout.SIZE.PERCENT;
			}
		} 

		if (this.flex) {
			this.sizeType = Layout.SIZE.FLEX;
		}

		if (this.isFlex() && this.parent.isFlex()) {
			this._notCalculateLayoutBeforeInit = true;
		}

		this._heightFixed = (this.height || (this.getEl().css('height') && this.getEl().css('height') != '0px')/* || this.flex*/) ? true : false;
		this._widthFixed  = (this.width  || (this.getEl().css('width')  && this.getEl().css('width')  != '0px')/* || this.flex*/) ? true : false;
		this.add(this.items, {notChaining: true});
		this._constructed = true;

		if (this._doLayoutAfterInit) {
			//// console.log('%cdoLayout after init -- ' + this.className, "background: #D32F2F; border-radius: 2px; color: white;");
			this.doLayout();
		}

		this.afterRender();

		return this;
	};

	Layout.prototype.initialize = function() {
		return;
	};

	Layout.prototype.afterRender = function() {
		return;
	};

	Layout.prototype.reinit = function(el, options) {
		this._constructed = false;
		this.constructor(el || this.parent && this.parent.getEl(), options || this._options || {});	
	};

	Layout.genId = function() {
		if (!$.fn['flexion'].count) $.fn['flexion'].count = 0;
		return 'layout' + $.fn['flexion'].count++; 
	};

	Layout.SIZE = {
		FIXED: 0,
		PERCENT: 1,
		FLEX: 2,
		DYNAMIC: 3
	}

	Layout.TYPE = {
		VERTICAL: 'vertical',
		HORIZONTAL: 'horizontal',
		ANCHOR: 'anchor'
	}

	Layout.ANCHOR = {
		START: 0,
		CENTER: 0.5,
		END: 1
	}

	window.Layout = Layout;
})(jQuery);