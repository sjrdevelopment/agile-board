define(
    [
        'backbone',
        'constants',
        'editStoryView',
        'editStoryModel',
        'jquery',
        'handlebars'
    ],
    function (
        Backbone,
        constants,
        editStoryView,
        editStoryModel,
        $,
        Handlebars
    ) {
        'use strict';

        var PROPERTIES = constants.story.properties,
            GENERIC_CLASSES = constants.genericClasses;

        describe('Edit story view', function() {
            var view;

            beforeEach(function(){
                window.event = {
                    target: 'window',
                    stopPropagation: function() {
                        return true;
                    }
                }
            });

            describe('On initialize', function() {

                beforeEach(function() {

                    view = new editStoryView({
                        model: new editStoryModel()
                    });

                });

                it('should inherit from Backbone.View', function() {
                    expect(view instanceof Backbone.View).toBe(true);
                });

                it('should add html overlay class', function() {
                    expect($('html').hasClass(GENERIC_CLASSES.overlayActive)).toBe(true);
                });
              
            });

            describe('On saveStoryChanges', function() {


                beforeEach(function() {

                    view = new editStoryView({
                        model: new editStoryModel()
                    });

                    spyOn(view.model, 'updateStoryModel');
     
                    view.saveStoryChanges();


                });

                it('should call updateStoryModel with form parameters array', function() {
                    expect(view.model.updateStoryModel).toHaveBeenCalled();
                });
              
                it('should remove html overlay class', function() {
                    expect($('html').hasClass(GENERIC_CLASSES.overlayActive)).toBe(false);
                });
            });

        });
    }
);
