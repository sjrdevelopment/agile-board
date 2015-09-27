define(['jquery', 'backbone', 'tasksCollection'], function($, Backbone, TasksCollection) {
	var tasks;

	var storyModel = Backbone.Model.extend({

		initialize: function() {
			//this.urlRoot = '/stories/' + this.get('id');
			this.urlRoot = 'v1/stories';
			this.idAttribute = 'id';
		},

		validate: function(attrs, options) {
		
		},
	
		syncWithApi:  function() {
	
			var changedAttributes = this.changed;
			
			if (!_.isEmpty(changedAttributes)) {
			
				this.save(changedAttributes, {patch:true});
			}
		}

	});

    return storyModel;
});