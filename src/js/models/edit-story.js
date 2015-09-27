define(['jquery', 'backbone', 'storyModel'], function($, Backbone, StoryModel) {
	
	var editStoryModel = Backbone.Model.extend({

		initialize: function(attr, options) {
			debugger;
			if (this.get('storyModel')) {
				_.extend(this.attributes, this.get('storyModel').attributes);
			}

			this.storiesCollection = options && options.storiesCollection;
		},

		updateStoryModel: function(paramArray) {
			var storyModel = this.get('storyModel');
			
			var dataChanged = {};

			_.each(paramArray, function(element, index, list) {

	    		if (storyModel.get(element.name) !== element.value) {
	          		dataChanged[element.name] = element.value;		
	          	} /*
	          	else {
	          		dataChanged[element.name] = element.value;
	          	}
	          	*/
	        });

	        storyModel.syncWithApi(dataChanged);
	        
	        if (this.storiesCollection) {
	         	this.storiesCollection.add(storyModel);
	        }
		
		}

	});

    return editStoryModel;
});