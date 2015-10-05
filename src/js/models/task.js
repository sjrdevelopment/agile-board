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

        onNewTaskSaveSuccess: function(options, response) {

            //chec this..
            var view = new TaskView({model: this});

            // check the functionality of this...


            // only need to uncomment this if we need timestamps etc from server.
                // need to fetch stories to get ID once created.
                // *** leave this comment in... ***
            /*
            if (options && options.newModel) {
                this.set(PROPERTIES.idAttribute, response);

                this.fetch();
            }
            */
        },

        syncWithApi:  function(changedAttributes) {
            if (!_.isEmpty(changedAttributes)) {
                changedAttributes[PROPERTIES.storyID] = this.get(PROPERTIES.storyID);

                if (this.get(PROPERTIES.idAttribute)) {
                    this.save(changedAttributes, {patch:true, error: this.showError});
                } else {
                    this.save(changedAttributes, {error: this.showError, success: _.bind(this.onNewTaskSaveSuccess, this)});
                }
            }
        }
    });

    return taskModel;
});