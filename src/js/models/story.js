define([
	'jquery',
	'backbone',
	'tasksCollection'
], function(
	$,
	Backbone,
	TasksCollection
) {
	var tasks;

	var storyModel = Backbone.Model.extend({

		initialize: function(attr, options) {
			//this.urlRoot = '/stories/' + this.get('id');
			this.urlRoot = 'v1/stories';
			this.idAttribute = 'id';

			if (options.newModel) {
				
				
			} else {
				this.setPriority();
			}
		},

		syncedModel: function(mod, response, options) {
			debugger;
			//this.attributes = response[0];
			
		},

		setPriority: function(options, response) {
			
			if (options && options.newModel) {

				this.set('id', response);

				this.fetch({
					success: _.bind(this.syncedModel, this)
				});
			}
		

			switch(parseInt(this.get('priority'), 10)) {
				case 1: this.set('isp1', true);
						this.set('isp2', false);
						this.set('isp3', false);
				break;
				case 2: this.set('isp1', false);
						this.set('isp2', true);
						this.set('isp3', false);
				break;
				case 3: this.set('isp1', false);
						this.set('isp2', false);
						this.set('isp3', true);
				break;
				default: this.set('isp1', false);
						 this.set('isp2', false);
						 this.set('isp3', false);
			}
		},

		validate: function(attrs, options) {
		
		},

		showError: function(error, options) {
			
		},
	
		syncWithApi:  function(changedAttributes) {
			
			if (!_.isEmpty(changedAttributes)) {
			
				this.save(changedAttributes, {patch:true, error: this.showError, success: _.bind(this.setPriority, this)});

			}
		}

	});

    return storyModel;
});