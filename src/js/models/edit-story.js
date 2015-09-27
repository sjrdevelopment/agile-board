define(['jquery', 'backbone'], function($, Backbone) {
	
	var editStoryModel = Backbone.Model.extend({

		initialize: function(attr, options) {
	
			_.extend(this.attributes, this.get('storyModel').attributes);
		},

		updateStoryModel: function(paramArray) {
			var storyModel = this.get('storyModel');
			
			var dataChanged = {};

			_.each(paramArray, function(element, index, list) {

	    		if (storyModel.get(element.name) !== element.value) {
	          		dataChanged[element.name] = element.value;
	          	}
	        });

	        storyModel.syncWithApi(dataChanged);
		
		}

	});

    return editStoryModel;
});