define(['jquery', 'backbone', 'tasksCollection'], function($, Backbone, TasksCollection) {
	var tasks;

	var storyModel = Backbone.Model.extend({

		initialize: function() {
			//this.urlRoot = '/stories/' + this.get('id');
			this.urlRoot = 'v1/stories';
			this.idAttribute = 'id';

			switch(this.get('priority')) {
				case 1: this.set('isp1', true);
				break;
				case 2: this.set('isp2', true);
				break;
				case 3: this.set('isp3', true);
				break;
				default: break;
			}
		},

		validate: function(attrs, options) {
		
		},
	
		syncWithApi:  function(changedAttributes) {
			
			if (!_.isEmpty(changedAttributes)) {
			
				this.save(changedAttributes, {patch:true});
			}
		}

	});

    return storyModel;
});