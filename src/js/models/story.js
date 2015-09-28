define(['backbone', 'constants'], function(Backbone, constants) {
    
    var PROPERTIES = constants.storyModel.properties,
        storyModel;

    storyModel = Backbone.Model.extend({

        initialize: function(attr, options) {
            debugger;
            this.urlRoot = PROPERTIES.apiUrl;
            this.idAttribute = PROPERTIES.idAttribute;

            if (options.newModel) {
                this.newModel = true;
            } else {
                this.setPriority();
            }
        },

        syncedModel: function(mod, response, options) {
        
        },

        setPriority: function(options, response) {
            if (this.newModel) {

                this.set(PROPERTIES.idAttribute, response);

                this.fetch({
                    success: _.bind(this.syncedModel, this)
                });
            }
        
            switch(parseInt(this.get(PROPERTIES.priority), 10)) {
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
                default: this.set(PROPERTIES.isp1, false);
                         this.set(PROPERTIES.isp2, false);
                         this.set(PROPERTIES.isp3, false);
            }
        },

        validate: function(attrs, options) {
        
        },

        showError: function(error, options) {
            
        },
    
        syncWithApi:  function(changedAttributes) {
            if (!_.isEmpty(changedAttributes)) {
                this.save(changedAttributes, {patch:true, error: this.showError, success: _.bind(this.setPriority, this)});
            }
        }
    });

    return storyModel;
});