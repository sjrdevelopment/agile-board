define(['backbone', 'taskModel', 'constants'], function(Backbone, Task, constants) {
    
    var PROPERTIES = constants.task.properties,
        Tasks;

    Tasks = Backbone.Collection.extend({
        model: Task,

        url: constants.apiBaseUrl + PROPERTIES.apiUrl,
        
        parse: function(response) {
            return _.without(response, null);
        }
    });

    return Tasks;
});