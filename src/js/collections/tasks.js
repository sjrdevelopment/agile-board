define(['backbone', 'taskModel', 'constants'], function(Backbone, Task, constants) {
    
    var PROPERTIES = constants.tasksCollection.properties,
        Tasks;

    Tasks = Backbone.Collection.extend({
        model: Task,

        url: constants.apiBaseUrl + PROPERTIES.apiUrl
        /*
        initialize: function() {
            this.url = 'http://localhost:3000/v1/tasks'; // test if it works without being in initialize
        }
        */
    });

    return Tasks;
});