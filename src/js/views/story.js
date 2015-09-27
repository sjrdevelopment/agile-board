define([
  'jquery',
  'backbone',
  'handlebars',
  'text!hbs/story-template.hbs',
  'editStoryView',
  'editStoryModel',
  'taskModel',
  'taskView',
  'editTaskModel',
  'editTaskView'
],function(
  $,
  Backbone,
  Handlebars,
  mainTemplate,
  EditStoryView,
  EditStoryModel,
  TaskModel,
  TaskView,
  EditTaskModel,
  EditTaskView
) {
  var storyView = Backbone.View.extend({

      tagName: 'div',
      
      className: 'story-row',

      // The DOM events specific to an item.
      events: {
        "click .story-edit-button": "onStoryEditClick",
        "click .story-delete-button": "onStoryDeleteClick",
        "click .new-task-button": "onNewTaskClick"
      },

      initialize: function() {
        console.log('initialise view');
        // this.render();

        // check this?
        this.listenTo(this.model.on('change', this.render.bind(this))); 
        
        this.listenTo(this.model.on('destroy', _.bind(this.removeView, this)));



        this.model.on('change:modified', _.bind(this.render, this));

      },

      removeView: function() {
        this.remove();
      },

      onNewTaskClick: function() {
        $('html').addClass('overlay-active');
        event.stopPropagation();

        $('body').on('click:rem', function(event) {
          if ( $(event.target).closest('.overlay').length === 0 ) {
              $('html').removeClass('overlay-active');
                  $('body').off('click:rem');
          } 
        });
        
        var storyID = this.model.get('id');
        debugger;
        
        var newTaskModel = new TaskModel({}, {newModel: true});

        var taskCreator = new EditTaskView({
          model: new EditTaskModel({
              taskModel: new TaskModel({
                story_id: storyID
              },{
                newModel: true
              })
          })
        });
      },

      onStoryEditClick: function() {
     
        var thisStoryModel = this.model;

        var editStory = new EditStoryView({
          model: new EditStoryModel({
            storyModel: thisStoryModel
          })
        });
      },

      onStoryDeleteClick: function() {
     
        this.model.destroy();
      },

      "mainTemplate":  Handlebars.compile(mainTemplate),

      // Re-renders the titles of the todo item.
      render: function() {
        
        this.$el.html(this.mainTemplate(this.model.attributes));
      
        return this;
        
      }
  });

  return storyView;

});