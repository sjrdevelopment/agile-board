define(['backbone', 'taskView', 'constants', 'underscore'], function(Backbone, TaskView, constants, _) {

    var PROPERTIES = constants.task.properties,
        taskModel;

    taskModel = Backbone.Model.extend({

        initialize: function(attr, options) {
            this.urlRoot = PROPERTIES.apiUrl;
            this.idAttribute = PROPERTIES.idAttribute;
        },

        showError: function(error) {
            console.log(error);
        },

        onSaveSuccess: function(options, response) {
            var view = new TaskView({model: this});

            if (options && options.newModel) {
                this.set(PROPERTIES.idAttribute, response);

                this.fetch({
                    success: _.bind(this.syncedModel, this)
                });
            }
        },

        syncWithApi:  function(changedAttributes) {
            if (!_.isEmpty(changedAttributes)) {
                changedAttributes[PROPERTIES.storyID] = this.get(PROPERTIES.storyID);

                if (this.get(PROPERTIES.idAttribute)) {
                    this.save(changedAttributes, {patch:true, error: this.showError});
                } else {
                    this.save(changedAttributes, {error: this.showError, success: _.bind(this.onSaveSuccess, this)});
                }
            }
        }
    });

    return taskModel;
});