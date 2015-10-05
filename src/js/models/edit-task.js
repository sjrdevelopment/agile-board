define(['backbone', 'taskModel', 'constants'], function(Backbone, TaskModel, constants) {
    
    var PROPERTIES = constants.editTaskModel.properties,
        EditTaskModel;
    
    EditTaskModel = Backbone.Model.extend({

        initialize: function(attr, options) {
            if (this.get(PROPERTIES.taskModel)) {
                _.extend(this.attributes, this.get(PROPERTIES.taskModel).attributes);
            }

            this.tasksCollection = options && options.tasksCollection;
        },

        updateTaskModel: function(paramArray) {
            var taskModel = this.get(PROPERTIES.taskModel),
                dataChanged = {};

            _.each(paramArray, function(element, index, list) {
                if (taskModel.get(element.name) !== element.value) {
                    dataChanged[element.name] = element.value;      
                } 
            });

            taskModel.syncWithApi(dataChanged);
            
            if (this.tasksCollection) {
                this.tasksCollection.add(taskModel);
            }
        }
    });

    return EditTaskModel;
});