define(
    [
        'jquery',
        'handlebars',
        'backbone',
        'constants',
        'storyView',
        'storyModel'
    ],
    function (
        $,
        Handlebars,
        Backbone,
        constants,
        StoryView,
        StoryModel
    ) {
        'use strict';

        var GENERIC_CLASSES = constants.genericClasses;

        describe('Story view', function() {
           var view;

            describe('On initialize', function() {
                beforeEach(function() {
                    view = new StoryView({
                        model: new StoryModel()
                    });
                });

                it('should inherit from Backbone.View', function() {
                    expect(view instanceof Backbone.View).toBe(true);
                });
            });

            describe('onNewTaskClick function', function() {
                var mockEvent = {},
                    dummyStoryID;

                Handlebars.registerHelper('select', function( value, options ){
                    var $el = $('<select />').html( options.fn(this) );
                    $el.find('[value="' + value + '"]').attr({'selected':'selected'});
                    return $el.html();
                });

                beforeEach(function() {
                    dummyStoryID = 'abc123';
                    
                    mockEvent = {
                        target: 'window',
                        stopPropagation: function() {
                            return true;
                        }
                    };

                    view = new StoryView({
                        model: new StoryModel({
                            id: dummyStoryID
                        })
                    });
                   
                    spyOn(view, 'setupNewTaskModel').and.callFake(function() {
                        return true;
                    });

                    view.onNewTaskClick(mockEvent);
                });

                it('should add class to html for overlay', function() {
                    expect($('html').hasClass(GENERIC_CLASSES.overlayActive)).toBe(true);
                });

                it('should call setupNewTaskModel function with expected value', function() {
                    expect(view.setupNewTaskModel).toHaveBeenCalledWith(dummyStoryID);
                });
            });

            describe('onStoryDeleteClick function', function() {
                beforeEach(function() {
                    view = new StoryView({
                        model: new StoryModel()
                    });
                    
                    //mock a confirm box clicking ok
                    spyOn(window, 'confirm').and.returnValue(true);
                    spyOn(view.model, 'destroy');

                    view.onStoryDeleteClick();
                });

                it('should call window confirm function', function() {
                    expect(window.confirm).toHaveBeenCalled();
                });

                it('should destroy this model on confirm returning true', function() {
                    expect(view.model.destroy).toHaveBeenCalled();
                });
            });
        });
    }
);
