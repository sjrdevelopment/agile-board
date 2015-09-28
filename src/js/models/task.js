define(['backbone', 'taskView', 'constants'], function(Backbone, TaskView, constants) {

    var PROPERTIES = constants.task.properties,
        taskModel;

    taskModel = Backbone.Model.extend({

        initialize: function(attr, options) {
            this.urlRoot = PROPERTIES.apiUrl;
            this.idAttribute = PROPERTIES.idAttribute;

            if (!(options && options.newModel)) {
                this.setPriority(); // or call setPriority.  if already has property set then don't re-set
            }
        },

        syncedModel: function(mod, response, options) {
            
        },

        showError: function(error) {
    
        },

        setPrePriority: function(options, response) {

        },

        setPriority: function(options, response) {
            var view = new TaskView({model: this});

            if (options && options.newModel) {
                this.set(PROPERTIES.idAttribute, response);

                this.fetch({
                    success: _.bind(this.syncedModel, this)
                });
            }

            switch (parseInt(this.get(PROPERTIES.priority), 10)) {
                case 1: this.set(PROPERTIES.isp1, true);
                        this.set(PROPERTIES.isp2, false);
                        this.set(PROPERTIES.isp3, false);
                break;
                case 2: this.set(PROPERTIES.isp1, false);
                        this.set(PROPERTIES.isp2, true);
                        this.set(PROPERTIES.isp3, false);
                break;
                case 3: this.set(PROPERTIES.isp1, false);
                        this.set(PROPERTIES.isp2, false);
                        this.set(PROPERTIES.isp3, true);
                break;
                default: this.set(PROPERTIES.isp1, true);
                         this.set(PROPERTIES.isp2, false);
                         this.set(PROPERTIES.isp3, false);
            }

            switch (this.get(PROPERTIES.status)) {
                case 'to do': this.set(PROPERTIES.isToDo, true);
                        this.set(PROPERTIES.isInProgress, false);
                        this.set(PROPERTIES.isDone, false);
                break;
                case 'in progress': this.set(PROPERTIES.isToDo, false);
                        this.set(PROPERTIES.isInProgress, true);
                        this.set(PROPERTIES.isDone, false);
                break;
                case 'done': this.set(PROPERTIES.isToDo, false);
                        this.set(PROPERTIES.isInProgress, false);
                        this.set(PROPERTIES.isDone, true);
                break;
                default: this.set(PROPERTIES.isToDo, true);
                        this.set(PROPERTIES.isInProgress, false);
                        this.set(PROPERTIES.isDone, false);
            }
        },

        syncWithApi:  function(changedAttributes) {
            if (!_.isEmpty(changedAttributes)) {
                changedAttributes[PROPERTIES.storyID] = this.get(PROPERTIES.storyID);
                
                if (this.get(PROPERTIES.idAttribute)) {
                    this.save(changedAttributes, {patch:true, error: this.showError, success: _.bind(this.setPrePriority, this)});
                } else {
                    this.save(changedAttributes, {error: this.showError, success: _.bind(this.setPriority, this)});
                }
            }
        }
    });

    return taskModel;
});