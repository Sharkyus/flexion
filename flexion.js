(function($) {
	$.fn['flexion'] = function(options) {
		options = options || {};
		this.type =		'fit'; //border, vert, hor, anchor, card, 
		this.width = 	this.width() 	|| options.width;
		this.height = 	this.height() 	|| options.height;
		this.items = 	null 			|| options.items;
		this.verAlign = 0				|| options.verAlign;
		this.horAlign = 0				|| options.horAlign;

		this.init = function(options) {
			if (!$.fn['flexion'].map) $.fn['flexion'].map = {};
			var cmp = $.fn['flexion'].getComponent(this);

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

	$.fn['flexion'].getComponent = function(el) {
		var cmpId = el.attr('data-layoutId');
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
			$.fn['flexion'].doLayout({notChaining: true, withoutResize: true});
		},10)
	});


	/*window.on('resize', function(e){
		//console.log(e.target.width);
		//clearTimeout(this.timer);
		this.timer = setTimeout(function(){
			$.fn['flexion'].doLayout({notChaining: true});
		}, 300);
	});*/



	var Layout = function(el, options) {
		options = options || {};
		this.customId = (options.id) ? true : false;
		options.id = options.id || Layout.genId();

		this.isLayout = true;
		this.type = Layout.TYPE.HORIZONTAL;
		this.sizeType = null;
		this.sizesMap = null; 
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

		this.un = function(eventName, handler, scope) {
			var handlers = this._eventHandlers[eventName];
			if (!handlers) return;
			for(var i=0; i<handlers.length; i++) {
			  	if (handlers[i][0] == handler) {
			    	handlers.splice(i--, 1);
			  	}
			}
		},

		this.fireEvent = function(eventName) {
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
				//console.log(['element'], this.cls);
				this.el = $(document.createElement('div'));
				this.el.append(this.items ? '' : this.html);
				if (this.cls) this.el.addClass(this.cls); 
				this.el.attr('data-layoutId', this.id);
				if (this.customId) {this.el.attr('id', this.id);}
				this.el.css({
					position: 'absolute',
					//display: 'block',
					height: this.height,
					width: this.width
				});
			}

			return this.el;
		};

		this.doLayout = function(options) {
			if (!this.items || this._detached) return;
			options = options || {};
			if (!options.withoutResize) this.distributeSizes();
			//console.log(['--- do layout'], this.cls);

			this.calculateHorizontal();
			this.calculateVertical();

			if (options.notChaining) true;
			for (var i in this.items) {
				var item = this.items[i];
				item.doLayout({withoutResize: options.withoutResize});
			}
		};

		//other layouts or html
		this.add = function(items, options) {
			if (!items || ($.isArray(items) && !items.length)) return;
			this.clearData();
			//console.log('111', items.length)
			options = options || {};
			items = $.isArray(items) ? items : [items];
			this.items = items;	
			for (var i in this.items) {
				var item = this.items[i];
				if(!item.isLayout) {
					var options = item;
					options.parent = this;
					item = new Layout(this.getEl(), options);
				} else {
					item.parent = this;
					item.reinit(this.getEl());
				}
				this.items[i] = item;

				this.distribute(item);
			};
			this.calculateAllFlex(this.items);

			if (options.silent || this._detached) return; 

			this.doLayout();
		};

		this.distributeSizes = function() {
			this.clearData();

			this.calculateAllFlex(this.items);
			for (var i in this.items) {
				var item = this.items[i];
				if (!(item.getEl().is(':visible') || item.fixed)) {
					this.sizesMap['fixed'].push(item);
					this.calcMap.push([0, 0]);
					continue;
				} 
				//console.log(item);
				if (item.isLayout) {
					item.distributeSizes();
				}

				this.distribute(item);
			}
		};

		this.clearData = function() {
			this._allFixedSummary = 0;
			this._allDynamicSummary = 0;
			this._allPercentsSummary = 0;
			this._allFlexSummary = 0;

			this.sizesMap = {
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
				case 'start': {
					return Layout.ANCHOR.START
				};
				case 'center': {
					return Layout.ANCHOR.CENTER
				};
				case 'end': {
					return LAYOUT.ANCHOR.END
				}
				default: return v;
			}
		};

		this.getHeight = function() {
			return this.height || this.getEl().height();
		};

		this.setHeight = function(v) {
			this.height = v;
			this.getEl().css({height: v});		
		};

		this.isHeightFixed = function() {
			return this._heightFixed;
		};

		this.isWidthFixed = function() {
			return this._widthFixed;
		};

		this.recalc = function() {

		};

		this.setHorizontalMethod = function(type) {
			switch(type) {
				case Layout.TYPE.VERTICAL: {
					this.distribute = function(item) {
						
						//console.log(['dist'], this.cls, item.cls);
						if (item.height && (typeof item.height == 'number' || item.height.toString().match('px'))) {
							this.sizesMap['fixed'].push(item);
							var height = parseInt(item.height);
							this.calcMap.push([height, Layout.SIZE.FIXED]);
							this._allFixedSummary += height;
							return;	
						} else if (item.height) {
							this.sizesMap['perc'].push(item);
							var width = parseInt(item.height);
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

					};
					break;
				}
				case Layout.TYPE.HORIZONTAL: {
					this.distribute = function(item) {
						//console.log(['distribute'], this.cls, item.cls);
						if (!(item.width || item.flex)) {
							this.sizesMap['dynamic'].push(item);	
							var width = item.getEl().width();
							this.calcMap.push([width, Layout.SIZE.DYNAMIC]);
							this._allFixedSummary += width;

							if (this.sizeType == Layout.SIZE.DYNAMIC) {
								this._allDynamicSummary += width;
								this.getEl().css('width', this._allDynamicSummary + 'px');
							}
							//console.log(width);
							return;
						} else if (item.width && (typeof item.width == 'number' || item.width.toString().match('px'))) {
							this.sizesMap['fixed'].push(item);
							var width = parseInt(item.width);
							this.calcMap.push([width, Layout.SIZE.FIXED]);
							this._allFixedSummary += width;
							return;	
						} else if (item.width) {
							this.sizesMap['perc'].push(item);
							var width = parseInt(item.width);
							item.sizeType = Layout.SIZE.PERCENT;
							this._allPercentsSummary += width;
							return;
						}
						if (item.flex) {
							this.sizesMap['flex'].push(item);
							this.calcMap.push([parseFloat((1 - ((this._allFlexSummary - item.flex)/this._allFlexSummary)).toFixed(10)), Layout.SIZE.FLEX]);						
							return;
						}
					};

					this.calculateHorizontal = function() {
						//console.log(['calculate'], this.cls);
						var cntWidth = this.getEl().width();

						var calcWidth = this._allFixedSummary + this._allPercentsSummary/100 * cntWidth;
						var horAnchor = 0;
						var flexWidth = cntWidth - calcWidth;
						for (var i in this.items) {
							var item = this.items[i],
								wVal = this.calcMap[i][0],
								wType = this.calcMap[i][1] == 1 ? '%' : 'px';
							if (this.calcMap[i][1] == Layout.SIZE.FLEX && flexWidth > 0) wVal *= flexWidth;

							if (wVal == 0) continue;

							item.getEl().css({
								width: wVal + wType,
								left: horAnchor + 'px'
							});

							if (this.calcMap[i][1] == Layout.SIZE.PERCENT) {
								wVal *= cntWidth/100;
							}

							horAnchor += wVal;
						}
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
						    item.getEl().css({
						    	top: cntHeight - item.getEl().height() * this.anchor + 'px'
						    });
						    if (!this.isHeightFixed() && (item.getEl().height() > this.getEl().height())) {
								this.setHeight(item.height || item.getEl().height());
							}
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

		return this.initialize(el, options);
	}

	Layout.prototype.initialize = function(el, options) {
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

		this.calcMap = [];
		this.setLayout();
		if (!$.fn['flexion'].map) $.fn['flexion'].map = {};
		$.fn['flexion'].map[this.id] = this;
		//console.log(['init layout'], this.cls);

		if (el) {
			var v = this.getEl();
			$(el).append(v);
			if (!(this.width || this.flex)) {
				this.sizeType = Layout.SIZE.DYNAMIC;
				this.getEl().css({
					position: 'fixed'
				});
				var w = this.getEl().width() + 1 + 'px';
				var h = this.getEl().height() + 'px';
				this.getEl().css({
					position: 'absolute'
				});
				this.getEl().css({
					width: w,
					height: h
				});
			}

			//console.log($(this.getEl()).width(), $(this.getEl()).attr('style'), 'add ', this.cls, ' to ', $(el).width(), el, $(el).attr('style'));
			this._detached = false;
		} else this._detached = true;

		if (this.parent && this.parent.type == Layout.TYPE.HORIZONTAL && this.width) {
			if (this.width && (typeof this.width == 'number' || this.width.toString().match('px'))) {
				this.sizeType = Layout.SIZE.FIXED;		
			} else if (this.width) {
				this.sizeType = Layout.SIZE.PERCENT;
			}
		} else if (this.parent && this.parent.type == Layout.TYPE.VERTICAL && this.height) {
			if (this.height && (typeof this.height == 'number' || this.width.toString().match('px'))) {
				this.sizeType = Layout.SIZE.FIXED;
			} else if (this.height) {
				this.sizeType = Layout.SIZE.PERCENT;
			}
		} 

		if (this.flex) {
			this.sizeType = Layout.SIZE.FLEX;
		}

		//console.log(['------------=========----------'], this.sizeType);

		this._heightFixed = (this.height || (this.getEl().css('height') && this.getEl().css('height') != '0px') || this.flex) ? true : false;
		this._widthFixed  = (this.width  || (this.getEl().css('width')  && this.getEl().css('width')  != '0px') || this.flex) ? true : false;
		//console.log('----------', this.id, this._widthFixed);
		
		this.add(this.items);
		this._inited = true;

		if (this.items) {
			//console.log(this.sizesMap);
			//console.log(this.calcMap);
		}
		return this;
	};

	Layout.prototype.reinit = function(el, options) {
		this._inited = false;
		this.initialize(el || this.parent && this.parent.getEl(), options || this._options || {});	
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