define(['jquery', 'backbone', 'taskView'], function($, Backbone, TaskView) {

	var taskModel = Backbone.Model.extend({

		initialize: function(attr, options) {
			//this.urlRoot = '/stories/' + this.get('id');
			this.urlRoot = 'v1/tasks';
			this.idAttribute = 'id';

			if (options && options.newModel) {
				
				
			} else {
				this.setPriority();
			}
		},

		syncedModel: function(mod, response, options) {
			debugger;
			//this.attributes = response[0];
			
		},

		showError: function(error) {
			debugger;
		},

		setPrePriority: function(options, response) {
			debugger;
		},

		setPriority: function(options, response) {
			
			debugger;
			var view = new TaskView({model: this});

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
				default: this.set('isp1', true);
						 this.set('isp2', false);
						 this.set('isp3', false);
			}

			switch(this.get('status')) {
				case 'to do': this.set('isToDo', true);
						this.set('isInProgress', false);
						this.set('isDone', false);
				break;
				case 'in progress': this.set('isToDo', false);
						this.set('isInProgress', true);
						this.set('isDone', false);
				break;
				case 'done': this.set('isToDo', false);
						this.set('isInProgress', false);
						this.set('isDone', true);
				break;
				default: this.set('isToDo', true);
						this.set('isInProgress', false);
						this.set('isDone', false);
			}
		},

		syncWithApi:  function(changedAttributes) {
			if (!_.isEmpty(changedAttributes)) {
				changedAttributes.story_id = this.get('story_id');

				
				if(this.get('id')) {
					debugger;
					this.save(changedAttributes, {patch:true, error: this.showError, success: _.bind(this.setPrePriority, this)});
				} else {
					debugger;
					this.save(changedAttributes, {error: this.showError, success: _.bind(this.setPriority, this)});
				}
			}
		}

	});

    return taskModel;
});