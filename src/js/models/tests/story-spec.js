define(
    [
        'backbone',
        'constants'
    ],
    function (
        Backbone,
        Constants
    ) {
        'use strict';


        describe('Story model', function () {
           var myVar;

            beforeEach(function() {
               myVar = 'stu';
            });

            it('should equal stu', function () {
                expect(myVar).toEqual('stu');
            });
        });
    }
);
