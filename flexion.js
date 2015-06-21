(function($) {
	  $.event.special.destroy = {
	    remove: function(o) {
	      if (o.handler) {
	        o.handler()
	      }
	    }
	  }
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
			//if (options.width)  this.css('width',  options.width );
			//if (options.height) this.css('height', options.height);
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
					//overflow: 'hidden',
					height: this.height,
					width: this.width
				});
			} 

			return this.el;
		};

		this.doLayout = function(options) {
			console.log('    %cdoLayout -- ' + this.className, 'background: #FFC107', options);
			options = options || {};
			if (!options.onlyLayout) {
				if (this._constructed && this.parent && (this.sizeType == Layout.SIZE.DYNAMIC || this.isPercentItemInDynamicLayout() || this.isFlexItemInDynamicLayout()) && !options.chainCall) {			
					console.log('        %cgo to parent -- ' + this.parent.className, 'background: grey');
					this.parent.doLayout(options);
					return;
				}

				if (!this.items || this._detached) return;
				if (!options.withoutResize) {
					this.distributeSizes(options);
					if (this.isDynamic()/* || this.isFlex() */|| this.isCLayout() && !options.chainCall) {
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

			if (this.type == Layout.TYPE.CARD) {
				this.showActiveItem();
			}
		};

		this.resizeDynamicContainer = function() {
			console.log('    %cresize dynamic container -- ' + this.className, 'background: #FFC107');
			switch(this.type) {
				case Layout.TYPE.HORIZONTAL: case Layout.TYPE.VERTICAL: {
					console.log(this.type == Layout.TYPE.HORIZONTAL, this._widthFixed, this.type == Layout.TYPE.VERTICAL, this._heightFixed)
					if ((this.type == Layout.TYPE.HORIZONTAL && this._widthFixed) || (this.type == Layout.TYPE.VERTICAL && this._heightFixed)) return;
					var targetProp = (this.type == Layout.TYPE.HORIZONTAL) ? 'width' : 'height';
					var size = 0; 	for (var i in this.sizesMap['fixed']) {
								size += this.sizesMap['fixed'][i];
								console.log('      %c' + this.itemsMap['fixed'][i].className + ' fixed container ' + targetProp + ' increment on ' + this.sizesMap['fixed'][i] + 'px' + '|| '+targetProp+' = ' + size + 'px', 'background: #FFCC80');	
							}
							for (var i in this.sizesMap['dynamic']) {
								size += this.sizesMap['dynamic'][i];
								console.log('      %c' + this.itemsMap['dynamic'][i].className + ' dynamic container '+targetProp+'  increment on ' + this.sizesMap['dynamic'][i] + 'px' + ' || '+targetProp+' = ' + size + 'px', 'background: #FFCC80');	
							}
							for (var i in this.sizesMap['perc']) { 
								var item = this.itemsMap['perc'][i];
								size += this.itemsMap['perc'][i].getEl()[targetProp]();
								console.log('      %c' + this.itemsMap['perc'][i].className + ' percent container '+targetProp+'  increment on ' + this.itemsMap['perc'][i].getEl().width() + 'px' + ' || '+targetProp+'  = ' + size + 'px', 'background: #FFCC80');
							}
							for (var i in this.sizesMap['flex']) { 
								var item = this.itemsMap['flex'][i];
								size += this.itemsMap['flex'][i].getEl()[targetProp]();
								console.log('      %c' + this.itemsMap['flex'][i].className + ' flex container '+targetProp+'  increment on ' + this.itemsMap['flex'][i].getEl().width() + 'px' + ' || '+targetProp+'  = ' + size + 'px', 'background: #FFCC80');
							}

							this.getEl().css(targetProp, size + this._allPaddings + this._allMargins + this._allBorders + this.paddings.tb + this.borders.tb +'px');	
			 			console.log('        %c' + this.className + ' container || '+targetProp+'  = ' + this.getEl()[targetProp]() + 'px', 'background: #FFCC80');
					break;
				}
				case Layout.TYPE.CARD: {
					//if ((this.type == Layout.TYPE.HORIZONTAL && this._widthFixed) || (this.type == Layout.TYPE.VERTICAL && this._heightFixed)) return;
					//alert(123)
					this.getEl().css({
						width: !this._widthFixed && (this.useMaxWidth ? this._maxWidth : this._activeItem.getEl().width()) + 'px',
						height: !this._heightFixed && (this.useMaxHeight ? this._maxHeight : this._activeItem.getEl().height()) +  'px',
					});			
			 			console.log('        %c' + this.className + ' container || width = ' + this.getEl().width()+ 'px, height = ' + this.getEl().height() + 'px', 'background: #FFCC80');
				}
			}
									
		};

		this._insertItems = function(ar1, ar2, pos) {
			var before = ar1.splice(0, pos);
			var after = ar1;
			var newAr = before;
			return before.concat(ar2, after);
		};

		//other layouts or html
		this.add = function(items, options) {
			var self = this;
			if (!items || ($.isArray(items) && !items.length)) return;
			this.clearData();
			options = options || {};
			items = $.isArray(items) ? items : [items];
			if (!isNaN(parseInt(options.position))) {
				this.items = this._insertItems(this.items, items, options.position);
			} else {
				this.items = $.merge(this.items, items);
			}	
			for (var i in items) {
				var item = items[i];
				var idx = this.items.indexOf(item);
				if(!item.isLayout) {
					item.parent = this;
					item = new Layout(this.getEl(), item);
				} else {
					item.parent = this;
					item.reinit(this.getEl());
				}

				item.on('remove', function(){
					self.items.splice(self.items.indexOf(this), 1);
				})

				if (!this._constructed && this.parent && !this.parent.isFlex() && this.isFlex() && item.isFlex()) {
					this.parent._doLayoutAfterInit = true;
				}
				this.items[idx] = item;
				items[i] = item;

				//this.distribute(item);
			};
			//this.calculateAllFlex(this.items);

			if (this._detached) return; 

			if (this.type == Layout.TYPE.CARD) {
				var position = this.items.indexOf(items[items.length - 1]);
				if (options.position) {
					position = options.position + items.length - 1
				}
				this.setActive(position, options);
			} else {
				this.doLayout(options);
			}
		};

		this.insert = function(items, position) {
			this.add(items, {position: position});		
		};

		this.replace = function(item, itemOrIndex) {
			var idx = itemOrIndex; 
			if (typeof itemOrIndex == 'object') {
				idx = this.items.indexOf(itemOrIndex);
			}
			if (idx > -1) {
				this.items[idx].remove();
				this.insert(item, idx);
			}
		}

		this.remove = function(items, options) {
			options = options || {};
			if (!items || ($.isArray(items) && !items.length) && !this.destroyed) {
				this.getEl().remove();
				this.destroyed = true;
				this.trigger('remove', this);
			} else {
				items = $.isArray(items) ? items : [items];
				for (var i in items) {
					var itemOrIndex = items[i];
					var idx = itemOrIndex; 
					if (typeof itemOrIndex == 'object') {
						idx = this.items.indexOf(itemOrIndex);
					}
					this.items[idx].remove(null, {notChaining: true});
				}

				if (this.isCLayout()) {
					var item = this.items[idx];
					if (!item) {
						idx = idx - 1;
						item = this.items[idx];
					}
					//f (!item) return
					this.setActive(idx);
				}
			}
			if (this._detached || options.notChaining) return;
			this.doLayout(options);
		};

		this.isParentHorizontal = function() { return this.parent && this.parent.type == Layout.TYPE.HORIZONTAL; };
		this.isParentVertical =   function() { return this.parent && this.parent.type == Layout.TYPE.VERTICAL;	 };
		this.isParentCard =       function() { return this.parent && this.parent.type == Layout.TYPE.CARD;	     };

		this.isCLayout = function() { return this.type == Layout.TYPE.CARD 			};
		this.isVLayout = function() { return this.type == Layout.TYPE.VERTICAL;	    };
		this.isHLayout = function() { return this.type == Layout.TYPE.HORIZONTAL;	};

		this.isDynamic = function() { return this.sizeType == Layout.SIZE.DYNAMIC;	};
		this.isFlex    = function() { return this.sizeType == Layout.SIZE.FLEX;     };
		this.isFixed   = function() { return this.sizeType == Layout.SIZE.FIXED;    };
		this.isPercent = function() { return this.sizeType == Layout.SIZE.PERCENT;  };

		this.distributeSizes = function(options) {

			console.log('    %cdistribute_sizes -- ' + this.className, 'background: wheat');
			options = options || {};
			this.clearData();

this.checked = true;
			/*if (this.isParentHorizontal() && (this.isDynamic() || this.isFlex())) {
				this.getEl().css({ width: ''  })

				console.log('    %cset width -- ' + (this.getEl().width()  + 1) + 'px -- ' + this.className, 'background: #2196F3; color: white');
				this.getEl().css({ width:  this.getEl().width()  + 1 });
			}
			if (this.isParentVertical()   && (this.isDynamic() || this.isFlex())) {
				this.getEl().css({ height: '' }).css({ height: this.getEl().height() + 1 });
			}*/
			this.getItemElData(this);
			this.calculateAllFlex(this.items);
			for (var i in this.items) {
				var item = this.items[i]; 

				

				if (item.type != Layout.TYPE.CARD) {
					item.updateVisibility();
					if (!item.getEl().is(':visible') /* || item.isFixed()*/) {
						this.itemsMap['fixed'].push(item);
						this.sizesMap['fixed'].push(0);
						this.calcMap.push({
							width: 0, 
							height: 0,
							type: Layout.SIZE.FIXED, 
							paddings: {lr: 0, tb: 0}, 
							margins: {lr: 0, tb: 0}, 
							borders: {lr: 0, tb: 0}
						});
						continue;
					} 
				}

				if (!options.notChaining) {
					if (item.isLayout) {
						//alert(123);
						item.distributeSizes();
					}
				} else {
					this.getItemElData(item);
				}
				
				this.distribute(item, options);
				/*if (this.isDynamic()) {
					this.resizeDynamicContainer();
				}*/
			}
			if (this._constructed && (this.isDynamic() || this.type == Layout.TYPE.CARD)) {
				this.resizeDynamicContainer();
			}
		};

		this.getItemElData = function(item) {
			item.paddings = {
				l: parseInt(item.getEl().css('padding-left')), r: parseInt(item.getEl().css('padding-right')),
				t: parseInt(item.getEl().css('padding-top')),  b: parseInt(item.getEl().css('padding-bottom')),
			} 
			item.paddings.lr = item.paddings.l + item.paddings.r;
			item.paddings.tb = item.paddings.t + item.paddings.b;

			item.margins = {
				l: parseInt(item.getEl().css('margin-left')), r: parseInt(item.getEl().css('margin-right')),
				t: parseInt(item.getEl().css('margin-top')),  b: parseInt(item.getEl().css('margin-bottom')),						
			}
			item.margins.lr = item.margins.l + item.margins.r;
			item.margins.tb = item.margins.t + item.margins.b;

			item.borders = {
				l: parseInt(item.getEl().css('border-left-width')), r: parseInt(item.getEl().css('border-right-width')),
				t: parseInt(item.getEl().css('border-top-width')),  b: parseInt(item.getEl().css('border-bottom-width'))							
			} 
			item.borders.lr = item.borders.l + item.borders.r;
			item.borders.tb = item.borders.t + item.borders.b;
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
			this._maxHeight = 0;
			this._maxWidth = 0;

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
			return this.parent && this.parent.isDynamic() && this.sizeType == Layout.SIZE.FLEX;
		};

		this.isFlexItemInFlexLayout = function(item) {
			return this.parent && this.parent.isFlex() && this.sizeType == Layout.SIZE.FLEX;
		};

		this.setHorizontalMethod = function(type) {
			switch(type) {
				case Layout.TYPE.VERTICAL: {
					this.distribute = function(item) {
						var paddings = item.paddings; var margins = item.margins; var borders = item.borders;
						if (item.isFixed()) {paddings.tb = 0; borders.tb = 0} 
						this._allPaddings += paddings.tb;
						this._allMargins += margins.tb;
						this._allBorders += borders.tb;
						var itemWidth = item.getEl().width() + paddings.lr + margins.lr + borders.lr;
						if (this._maxWidth < itemWidth) this._maxWidth = itemWidth;

						var data = {
							width: itemWidth, 
							type: Layout.SIZE.DYNAMIC, 
							paddings: paddings, 
							margins: margins, 
							borders: borders
						};

						console.log('        %cdistribute -- ' + this.className + ' ' + item.className, 'background: #43A047; color: white');
						if (item.isDynamic() || item.isPercentItemInDynamicLayout() || item.isFlexItemInDynamicLayout()) {
							if (!item.items || (item.items && !item.items.length)) {
								item.getEl().css('position', 'fixed');
								item.getEl().css('height', '');
								item.getEl().css('width', '');
								item.getEl().css('width', item.getEl().outerWidth());
								data.width = item.getEl().width() + paddings.lr + margins.lr + borders.lr;
								if (this._maxWidth < data.width) this._maxWidth = data.width;
							}
							this.itemsMap['dynamic'].push(item);	
							var height = item.getEl().outerHeight();
							item.getEl().css('position', 'absolute');

							this.sizesMap['dynamic'].push(height);
							data.height = height;
							data.type = Layout.SIZE.DYNAMIC;
							console.log('            %cDYNAMIC -- || height = ' + height + 'px', 'color: white; background: #212121');
							this.calcMap.push(data);
							
							this._allFixedSummary += height;
							return;
						} else if (item.height && (typeof item.height == 'number' || item.height.toString().match('px'))) {
							this.itemsMap['fixed'].push(item);
							var height = parseInt(item.height);
							console.log('            %cFIXED -- || height = ' + height + 'px', 'color: white; background: #212121');
							//this.calcMap.push([height, Layout.SIZE.FIXED, paddings.lr, margins.lr, borders.lr]);
							this.sizesMap['fixed'].push(height);
							
							data.height = height;
							data.type = Layout.SIZE.FIXED;
							this.calcMap.push(data);
							this._allFixedSummary += height;
							return;	
						} else if (item.height) {
							this.itemsMap['fixed'].push(item);
							this.itemsMap['perc'].push(item);
							console.log('            %cPERCENTS -- || height = ' + item.height, 'color: white; background: #212121');
							var height = parseInt(item.height);
							data.height = height;
							data.type = Layout.SIZE.PERCENT;
							this.calcMap.push(data);
							this.sizesMap['perc'].push(height);
							this._allPercentsSummary += height;
							return;
						}
						if (item.flex) {
							this.itemsMap['flex'].push(item);
							item.sizeType = Layout.SIZE.PERCENT;
							var size = parseFloat((1 - ((this._allFlexSummary - item.flex)/this._allFlexSummary)).toFixed(10));
							console.log('            %cFLEX -- || flex size = ' + size, 'color: white; background: #212121');
							
							data.height = size;
							data.type = Layout.SIZE.FLEX;
							this.calcMap.push(data);
							this.sizesMap['flex'].push(size);					
							return;
						}
					};

					this.calculateHorizontal = function(items) {
						//return;
						/*var cntWidth = this.getEl().width() * this.anchor;	

						for (var i in this.items) {
							var item = this.items[i];
						    if (!this.isWidthFixed() && (item.getEl().width() > this.getEl().width())) {
								this.setWidth(item.width || item.getEl().width());
							}
						    item.getEl().css({
						    	left: cntWidth - item.getEl().width() * this.anchor + 'px'
						    });
						}*/
						if (!this.isWidthFixed()) {
							this.setWidth(this._maxWidth);
						}	
						var cntWidth = this.getEl().width() * this.anchor;
						//console.log(['!!!!!!!!!!!!!!!!!!!!!!!'], this.getEl().height());

						for (var i in this.items) {
							var item = this.items[i];
							var data = this.calcMap[i];
							var width = item.getEl().width() + data['paddings']['tb'] + data['margins']['tb']  + data['borders']['tb']

						   /*if (!this.isHeightFixed() && (height > this.getEl().height())) {
								this.setHeight(height);
							}*/
						    item.getEl().css({
						    	left: cntWidth- width * this.anchor + this.paddings.l + 'px'
						    });
						}

					}
					break;
				}
				case Layout.TYPE.HORIZONTAL: {
					this.distribute = function(item, options) {
						var paddings = item.paddings; var margins = item.margins; var borders = item.borders;
						if (item.isFixed()) {paddings.lr = 0; borders.lr = 0} 
						this._allPaddings += paddings.lr;
						this._allMargins += margins.lr;
						this._allBorders += borders.lr;
						var itemHeight = item.getEl().height() + paddings.tb + margins.tb + borders.tb;
						if (this._maxHeight < itemHeight) this._maxHeight = itemHeight;

						var data = {
							height: itemHeight, 
							type: Layout.SIZE.DYNAMIC, 
							paddings: paddings, 
							margins: margins, 
							borders: paddings
						};

						console.log('        %cdistribute -- ' + item.className + ' of ' + this.className, 'background: #43A047; color: white');
						if (item.isDynamic() || item.isPercentItemInDynamicLayout() || item.isFlexItemInDynamicLayout()/* || item.isFlexItemInFlexLayout()*/) {
							if (!item.items || (item.items && !item.items.length)) {
								item.getEl().css('position', 'fixed');
								item.getEl().css('width', '');
								item.getEl().css('height', '');
								item.getEl().css('height', item.getEl().outerHeight());

								if (item.className == 'google-maps-header') {
									console.trace();
									console.log(item.getEl().outerHeight(), paddings.tb, margins.tb, borders.tb);
								}
								data.height = item.getEl().height() + paddings.tb + margins.tb + borders.tb;
								if (this._maxHeight < data.height) this._maxHeight = data.height;
							}
							this.itemsMap['dynamic'].push(item);	
							var width = item.getEl().outerWidth();
							console.log('            %cDYNAMIC -- || width = ' + width + 'px', 'color: white; background: #212121');
							item.getEl().css('position', 'absolute');

							this.sizesMap['dynamic'].push(width);
							data.width = width;
							data.type = Layout.SIZE.DYNAMIC;
							this.calcMap.push(data);
							
							this._allFixedSummary += width;
							return;
						} else if (item.width && (typeof item.width == 'number' || item.width.toString().match('px'))) {
							this.itemsMap['fixed'].push(item);
							var width = parseInt(item.width);
							console.log('            %cFIXED -- || width = ' + width + 'px', 'color: white; background: #212121');
							//this.calcMap.push([width, Layout.SIZE.FIXED, paddings.lr, margins.lr, borders.lr]);
							this.sizesMap['fixed'].push(width);
							
							data.width = width;
							data.type = Layout.SIZE.FIXED;
							this.calcMap.push(data);
							this._allFixedSummary += width;
							return;	
						} else if (item.width) {
							this.itemsMap['fixed'].push(item);
							this.itemsMap['perc'].push(item);
							console.log('            %cPERCENTS -- || width = ' + item.width, 'color: white; background: #212121');
							var width = parseInt(item.width);
							data.width = width;
							data.type = Layout.SIZE.PERCENT;
							this.calcMap.push(data);
							this.sizesMap['perc'].push(width);
							this._allPercentsSummary += width;
							return;
						}
						if (item.flex) {
							this.itemsMap['flex'].push(item);
							item.sizeType = Layout.SIZE.PERCENT;
							var size = parseFloat((1 - ((this._allFlexSummary - item.flex)/this._allFlexSummary)).toFixed(10));
							console.log('            %cFLEX -- || flex size = ' + size, 'color: white; background: #212121');
							
							data.width = size;
							data.type = Layout.SIZE.FLEX;
							this.calcMap.push(data);
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
								wVal = this.calcMap[i]['width'],
								wType = this.calcMap[i]['type'] == 1 ? '%' : 'px';
							if (this.calcMap[i]['type'] == Layout.SIZE.FLEX && flexWidth > 0) wVal *= flexWidth;

							if (wVal == 0) continue;


							console.log('	%ccalculate -- ' + this.calcMap[i]['width'] + ' ' + item.className + ' in ' + this.className + ' || '+ 'width = ' + (wVal + wType) + '; left = ' + (horAnchor + 'px'), 'color: white; background: #2196F3');
							item.getEl().css({
								width: wVal + wType,
								left: horAnchor + this.paddings.l + 'px'
							});

							if (this.calcMap[i]['type'] == Layout.SIZE.PERCENT) {
								wVal *= cntWidth/100;
							}

							horAnchor += wVal + this.calcMap[i]['paddings']['lr'] + this.calcMap[i]['margins']['lr']  + this.calcMap[i]['borders']['lr'];
						}


						console.log('    %cSummary container (' + this.className + ') width = ' + this.getEl().width() + 'px', 'color: black; background: #FFAB91');
					};
					break;
				}
				case Layout.TYPE.CARD: {
					this.distribute = function(item, options) {
						item.getEl().css('display','');
						var paddings = item.paddings; var margins = item.margins; var borders = item.borders;
						this._allPaddings += paddings.lr;
						this._allMargins += margins.lr;
						this._allBorders += borders.lr;
						var itemHeight = item.getEl().height() + paddings.tb + margins.tb + borders.tb;
						if (this._maxHeight < itemHeight) this._maxHeight = itemHeight;
						var itemWidth = item.getEl().width() + paddings.lr + margins.lr + borders.lr;
						if (this._maxWidth < itemWidth) this._maxWidth = itemWidth;
						var data = {
							type: Layout.SIZE.DYNAMIC, 
							paddings: paddings, 
							margins: margins, 
							borders: borders
						};

						console.log('        %cdistribute -- ' + item.className + ' of ' + this.className, 'background: #43A047; color: white');

						if (!item.items || (item.items && !item.items.length)) {
							item.getEl().css('position', 'fixed');
							item.getEl().css('width', '');
							/*data.height = item.getEl().height() + paddings.tb + margins.tb + borders.tb;
							if (this._maxHeight < data.height) this._maxHeight = data.height;*/
						}
						this.itemsMap['dynamic'].push(item);	
						var width = item.getEl().width();
						console.log('            %cDYNAMIC -- || width = ' + width + 'px', 'color: white; background: #212121');
						item.getEl().css('position', 'absolute');

						this.sizesMap['dynamic'].push(width);
						data.width = width;
						//data.height = height;
						data.type = Layout.SIZE.DYNAMIC;
						this.calcMap.push(data);
						
						this._allFixedSummary += width;
						
						if (this._activeItem.id != item.id) {  
							item.getEl().css('display', 'none');
						}
					};

					this.calculateHorizontal = function() {
						/*if (!this.isHeightFixed()) {
							this.setHeight(this._maxHeight);
						}	*/
						var cntWidth = this.getEl().width() * this.anchorX;
						//console.log(['!!!!!!!!!!!!!!!!!!!!!!!'], this.getEl().height());

						var idx = this.items.indexOf(this._activeItem);
						var item = this.items[idx];
						var data = this.calcMap[idx];
						var width = item.getEl().width() + data['paddings']['lr'] + data['margins']['lr']  + data['borders']['lr']
					   /*if (!this.isHeightFixed() && (height > this.getEl().height())) {
							this.setHeight(height);
						}*/
					    item.getEl().css({
					    	left: cntWidth - width * this.anchorX + 'px'
					    });
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
						var flexHeight = cntHeight - calcHeight - this._allMargins - this._allPaddings - this._allBorders;
						for (var i in this.items) {
							var item = this.items[i],
								hVal = this.calcMap[i]['height'],
								hType = this.calcMap[i]['type'] == 1 ? '%' : 'px';
							if (this.calcMap[i]['type'] == Layout.SIZE.FLEX && flexHeight > 0) hVal *= flexHeight;

							if (hVal == 0) continue;

							item.getEl().css({
								height: hVal + hType,
								top: verAnchor + this.paddings.t + 'px'
							});

							if (this.calcMap[i]['type'] == Layout.SIZE.PERCENT) {
								hVal *= cntHeight/100;
							}

							verAnchor += hVal + this.calcMap[i]['paddings']['tb'] + this.calcMap[i]['margins']['tb']  + this.calcMap[i]['borders']['tb'];
						}
					}
					break;
				}
				case Layout.TYPE.HORIZONTAL: {
					this.calculateVertical = function() {
						if (!this.isHeightFixed()) {
							this.setHeight(this._maxHeight);
						}	
						var cntHeight = this.getEl().height() * this.anchor;
						//console.log(['!!!!!!!!!!!!!!!!!!!!!!!'], this.getEl().height());

						for (var i in this.items) {
							var item = this.items[i];
							var data = this.calcMap[i];
							var height = item.getEl().height() + data['paddings']['tb'] + data['margins']['tb']  + data['borders']['tb']
						   /*if (!this.isHeightFixed() && (height > this.getEl().height())) {
								this.setHeight(height);
							}*/
						    item.getEl().css({
						    	top: cntHeight - height * this.anchor + this.paddings.t + 'px'
						    });
						}


						// var cntHeight = this.getEl().height() * this.anchor;	

						// for (var i in this.items) {
						// 	var item = this.items[i];
						//     if (!this.isHeightFixed() && (item.getEl().height() > this.getEl().height())) {
						// 		this.setHeight(item.height || item.getEl().height());
						// 	}
						//     item.getEl().css({
						//     	top: cntHeight - item.getEl().height() * this.anchor + 'px'
						//     });
						// }

					}
					break;
				}
				case Layout.TYPE.CARD: {
					this.calculateVertical = function() {
						var cntHeight = this.getEl().height() * this.anchorY;
						//console.log(['!!!!!!!!!!!!!!!!!!!!!!!'], this.getEl().height());

						var idx = this.items.indexOf(this._activeItem);
						var item = this.items[idx];
						var data = this.calcMap[idx];
						var height = item.getEl().height() + data['paddings']['tb'] + data['margins']['tb']  + data['borders']['tb']
					   /*if (!this.isHeightFixed() && (height > this.getEl().height())) {
							this.setHeight(height);
						}*/
					    item.getEl().css({
					    	top: cntHeight - height * this.anchorY + 'px'
					    });
						
					}
				}
			}
		}

		return this.constructor(el, options);
	}

	Layout.prototype.constructor = function(el, options) {
		console.log('%cinit ' + this.className, "background: grey; border-radius: 2px; color: white;");
		
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
		if (this.flex) {
			this.sizeType = Layout.SIZE.FLEX;
		}
		if (el) {
			var v = this.getEl();
			$(el).append(v);
			//if (this.parent) console.log(['!!!'], this.parent._dynamicFlex, this.isFlex(), this.parent.isDynamic(),  this.isFlex());

			if ((this.parent && this.parent.type == Layout.TYPE.HORIZONTAL && this.width) || (!this.parent && this.width)) {
				if (this.width && (typeof this.width == 'number' || this.width.toString().match('px'))) {
					this.sizeType = Layout.SIZE.FIXED;		
				} else if (this.width) {
					this.sizeType = Layout.SIZE.PERCENT;
				}
			} else if ((this.parent && this.parent.type == Layout.TYPE.VERTICAL && this.height) || (!this.parent && this.height)) {
				if (this.height && (typeof this.height == 'number' || this.height.toString().match('px'))) {
					this.sizeType = Layout.SIZE.FIXED;
				} else if (this.height) {
					this.sizeType = Layout.SIZE.PERCENT;
				}
			} 

			if (this.isParentHorizontal() || !this.parent) {
				if (!(this.width || this.flex) || this.isDynamicFlex()) {
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
			if (this.isParentVertical() || !this.parent) {
				if (!(this.height || this.flex) || this.isDynamicFlex()) {
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
			
			//TODO: revise a job provided if (this.isParentCard() || !this.parent) 
			if (this.isParentCard()) {
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

			/*if (this.height && typeof this.height == 'string' && this.height.match('%')) {
				this.getEl().css('height', this.height);
			}*/

			//if (this.width && typeof this.width == 'string' && this.width.match('%')) {
			//	this.getEl().css('width', parseInt(this.width)/100 * this.getEl().parent('div').width());
			//}
			//console.log($(this.getEl()).width(), $(this.getEl()).attr('style'), 'add ', this.className, ' to ', $(el).width(), el, $(el).attr('style'));
			

			this._detached = false;
		} else this._detached = true;

		if (this.isDynamicFlex()) {
			this._dynamicFlex = true;	
		}

		if (this.isFlex() && this.parent.isFlex()) {
			this._notCalculateLayoutBeforeInit = true;
		}

		console.log(this.height, this.getEl().css('height'))

		this._heightFixed = (this.height || (this.getEl().height())/* || this.flex*/) ? true : false;
		this._widthFixed  = (this.width  || (this.getEl().width())/* || this.flex*/) ? true : false;
		//console.log(this._heightFixed, this._widthFixed, this.sizeType);
		var items = [];
		if (this.items) 
			items = items.concat(this.items);
		this.items = [];
		//console.log(items);
		this.add(items, {notChaining: true});

		if (this._doLayoutAfterInit) {
			console.log('%cdoLayout after init -- ' + this.className, "background: #D32F2F; border-radius: 2px; color: white;");
			this.doLayout();
		}
		this._constructed = true;

		this.afterRender();
		return this;
	};

	Layout.prototype.hideActiveItem = function() {
		if (this._activeItem) 
			this._activeItem.getEl().css('display', 'none');
	};

	Layout.prototype.showActiveItem = function() {
		if (this._activeItem) 
			this._activeItem.getEl().css('display', '');
	};

	Layout.prototype.getActive = function() {
		return this._activeItem;
	};

	Layout.prototype.setActive = function(itemOrIndex, options) {
		options = options || {};
		var idx = itemOrIndex; 
		if (typeof itemOrIndex == 'object') {
			idx = this.items.indexOf(itemOrIndex);
		}
		if (idx > -1) {
			this.hideActiveItem();
			this._activeItem = this.items[idx];
		 	this.doLayout(options);
		}
	};

	Layout.prototype.isDynamicFlex = function() {
		return this.parent && ((this.parent._dynamicFlex && this.isFlex()) || (this.parent.isDynamic() && this.isFlex()));
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
		CARD: 'card'
	}

	Layout.ANCHOR = {
		START: 0,
		CENTER: 0.5,
		END: 1
	}

	window.Layout = Layout;
})(jQuery);