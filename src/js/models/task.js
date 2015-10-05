define(['backbone', 'taskView', 'constants', 'underscore'], function(Backbone, TaskView, constants, _) {

    var PROPERTIES = constants.task.properties,
        TaskModel;

    TaskModel = Backbone.Model.extend({

        initialize: function(attr, options) {
            this.urlRoot = PROPERTIES.apiUrl;
            this.idAttribute = PROPERTIES.idAttribute;
        },

        showError: function(error) {
            console.log(error);
        },

        onNewTaskSaveSuccess: function(options, response) {
            var view = new TaskView({model: this});
        },

        syncWithApi:  function(changedAttributes) {
            if (!_.isEmpty(changedAttributes)) {
                changedAttributes[PROPERTIES.storyID] = this.get(PROPERTIES.storyID);

                if (this.get(PROPERTIES.idAttribute)) {
                    // existing model
                    this.save(changedAttributes, {patch:true, error: this.showError});
                } else {
                    // new model
                    this.save(changedAttributes, {error: this.showError, success: _.bind(this.onNewTaskSaveSuccess, this)});
                }
            }
        }
    });

    return TaskModel;
});