define(['backbone', 'storyModel', 'constants'], function(Backbone, StoryModel, constants) {
    var PROPERTIES = constants.editStoryModel.properties,
        editStoryModel;

    editStoryModel = Backbone.Model.extend({

        initialize: function(attr, options) {
            if (this.get(PROPERTIES.storyModel)) {
                _.extend(this.attributes, this.get(PROPERTIES.storyModel).attributes);
            }

            this.storiesCollection = options && options.storiesCollection;
        },

        updateStoryModel: function(paramArray) {
            var storyModel = this.get(PROPERTIES.storyModel),
                dataChanged = {};

            _.each(paramArray, function(element, index, list) {
                if (storyModel.get(element.name) !== element.value) {
                    dataChanged[element.name] = element.value;      
                }
            });

            storyModel.syncWithApi(dataChanged);
            
            if (this.storiesCollection) {
                this.storiesCollection.add(storyModel);
            }
        }
    });

    return editStoryModel;
});