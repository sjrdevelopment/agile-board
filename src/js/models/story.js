define(['backbone', 'constants', 'underscore'], function(Backbone, constants, _) {

    var PROPERTIES = constants.story.properties,
        storyModel;

    storyModel = Backbone.Model.extend({

        initialize: function(attr, options) {
            this.urlRoot = PROPERTIES.apiUrl;
            this.idAttribute = PROPERTIES.idAttribute;

            // what does this do again?
            // tidy up...
            if (options && options.newModel) {
                this.newModel = true;
            } else {

            }
        },

        showError: function(error) {
            console.log(error);
        },

        onSaveSuccess: function(options, response) {
       
            if (this.newModel) {
                // need to fetch data from server if new, so story ID can be set
                    // need story ID for adding tasks later.

                this.set(PROPERTIES.idAttribute, response);

                this.fetch();

                this.newModel = false;
            }

            // if not a new model (editing), we will already know storyID

        },

        syncWithApi:  function(changedAttributes) {
      
            if (!_.isEmpty(changedAttributes)) {
                this.save(changedAttributes, {patch:true, error: this.showError, success: _.bind(this.onSaveSuccess, this)});
            }
        }
    });

    return storyModel;
});