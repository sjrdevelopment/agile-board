define(
    [
        'jquery',
        'backbone',
        'constants',
        'editStoryView',
        'editStoryModel'
    ],
    function (
        $,
        Backbone,
        constants,
        EditStoryView,
        EditStoryModel
    ) {
        'use strict';

        var GENERIC_CLASSES = constants.genericClasses;

        describe('Edit story view', function() {
            var view;

            beforeEach(function(){
                window.event = {
                    target: 'window',
                    stopPropagation: function() {
                        return true;
                    }
                }

                view = new EditStoryView({
                    model: new EditStoryModel()
                });
            });

            describe('On initialize', function() {
                it('should inherit from Backbone.View', function() {
                    expect(view instanceof Backbone.View).toBe(true);
                });

                it('should add html overlay class', function() {
                    expect($('html').hasClass(GENERIC_CLASSES.overlayActive)).toBe(true);
                });
            });

            describe('On saveStoryChanges', function() {
                beforeEach(function() {
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
