require.config({

    paths: {
        // libs

        "jquery": "../bower_components/jquery/dist/jquery.min",
        "underscore": "../bower_components/underscore/underscore-min",
        "backbone": "../bower_components/backbone/backbone-min",
        "handlebars": "../bower_components/handlebars/handlebars.min",
        "requirejs": "../bower_components/requirejs/require",
        "text": "../bower_components/requirejs-text/text",
  
        // components
        
        "appController": "js/app-controller",
        "storiesCollection": "js/collections/stories",
        "storyModel": "js/models/story",
        "storyView": "js/views/story",
        "tasksCollection": "js/collections/tasks",
        "taskModel": "js/models/task",
        "taskView": "js/views/task"
     },

    deps: [
        'jquery'
    ],

    shim: {
        backbone: {
            deps: ['underscore', 'jquery'],
            'exports': 'backbone'
        }
    },

    hbars: {
        extension: '.hbs'
    }

});