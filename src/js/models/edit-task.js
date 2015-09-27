define(['jquery', 'backbone', 'taskModel'], function($, Backbone, TaskModel) {
	
	var editTaskModel = Backbone.Model.extend({

		initialize: function(attr, options) {
			debugger;
			if (this.get('taskModel')) {
				_.extend(this.attributes, this.get('taskModel').attributes);
			}

			this.tasksCollection = options && options.tasksCollection;
		},

		updateTaskModel: function(paramArray) {
			var taskModel = this.get('taskModel');
			
			var dataChanged = {};

			_.each(paramArray, function(element, index, list) {

	    		if (taskModel.get(element.name) !== element.value) {
	          		dataChanged[element.name] = element.value;		
	          	} /*
	          	else {
	          		dataChanged[element.name] = element.value;
	          	}
	          	*/
	        });

	        taskModel.syncWithApi(dataChanged);
	        
	        if (this.tasksCollection) {
	         	this.tasksCollection.add(taskModel);
	        }
		
		}

	});

    return editTaskModel;
});