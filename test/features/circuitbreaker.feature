Feature: Circuit Breaker

Scenario: New circuit should be closed

    Given a circuit breaker
    Then the circuit should be closed

Scenario: Calls that don't timeout - [Name]

    Given a circuit breaker
    And setting the timeout to [Timeout] ms
    When a call that lasts [ms] ms is made
    And time advances by [ms] ms
    Then the promise succeeds

    Where:
    Name            |   Timeout |   ms
    Boundry case    |   100     |   99
    Normal case     |   100     |   50
    No timeout      |   0       |   500
    
Scenario: Calls that do timeout - [Name]

    Given a circuit breaker
    And setting the timeout to 100 ms
    When a call that lasts [ms] ms is made
    And time advances by [ms] ms
    Then the promise fails with TimeoutError

    Where:
    Name            |   ms
    Boundry case 1  |   100
    Boundry case 2  |   101
    Normal case     |   300

Scenario: Error threshold - [Name]
    
    Given a circuit breaker
    And setting the volume threshold to 0
    And setting the error threshold to .1
    When [Num ok] calls that succeed are made
    And [Num error] calls that fail are made
    Then the circuit should be [State]

    Where:
    Name            |   Num ok  |   Num error   |   State
    Under threshold |   19      |   1           |   closed
    On threshold    |   9       |   1           |   open
    Over threshold  |   5       |   1           |   open

Scenario: When the circuit is open the call should never be made

    Given a circuit breaker
    And setting the volume threshold to 0
    And setting the error threshold to 0
    When one call that fails is made
    And I make a call which I spy
    Then the promise fails with OpenCircuitError
    And the protected call should not be made

Scenario: Volume request threshold - [Name]

    Given a circuit breaker
    And setting the error threshold to 0
    And setting the volume threshold to 10
    When [Num] calls that fail are made
    Then the circuit should be [State]

    Where:
    Name                |   Num |   State
    Under threshold     |   3   |   closed
    Boundry case        |   9   |   closed
    Over threshold      |   10  |   open

Scenario: Setting TimeoutError threshold lower than general error threshold - [Name]

    Given a circuit breaker
    And setting the timeout to 1 ms
    And setting the error threshold to .1
    And setting the TimeoutError error threshold to .05
    And setting the volume threshold to 0
    When [Num ok] calls that succeed are made
    And [Num timeout] calls that timeout are made
    And [Num error] calls that fail are made
    Then the circuit should be [State]
    
    Where:
    Name                |   Num ok  |   Num timeout |   Num error   |   State
    Both under          |   28      |   1           |   1           |   closed
    Error on boundry    |   9       |   0           |   1           |   open
    Timeout on boundry  |   19      |   1           |   0           |   open
    Error over          |   8       |   0           |   1           |   open
    Timeout over        |   18      |   1           |   0           |   open

Scenario: Setting TimeoutError threshold to zero - [Name]

    Given a circuit breaker
    And setting the timeout to 1 ms
    And setting the error threshold to .1
    And setting the TimeoutError error threshold to 0
    And setting the volume threshold to 0
    When [Num ok] calls that succeed are made
    And [Num timeout] calls that timeout are made
    And [Num error] calls that fail are made
    Then the circuit should be [State]
    
    Where:
    Name                |   Num ok  |   Num timeout |   Num error   |   State
    Both under          |   29      |   0           |   1           |   closed
    Error on boundry    |   9       |   0           |   1           |   open
    Timeout over        |   39      |   1           |   0           |   open
    Error over          |   8       |   0           |   1           |   open

Scenario: Reset Circuit Timeout - [Name]

    Given a circuit breaker
    And setting the reset time to 10 ms
    And setting the timeout to 10 ms
    And setting the error threshold to 0
    And setting the volume threshold to 0
    When a call that lasts 10 ms is made
    And time advances by [ms] ms
    And I catch TimeoutError
    Then the circuit should be [State]

    Where:
    Name                    |   ms  |   State
    Before timeout          |   9   |   closed
    Before reset timeout    |   15  |   open
    On reset timeout        |   20  |   open
    After reset timeout     |   21  |   half-open

Scenario: Reset Circuit Clears Rolling Window
    
    Given a circuit breaker
    And setting the reset time to 10 ms
    And setting the error threshold to 0
    And setting the volume threshold to 0
    When one call that fails is made
    And time advances by 11 ms
    And one call that succeeds is made
    Then the error percentage is 0
    And the current counts is empty
    

Scenario: Half-Open circuit should allow only one call to test status

    Given a circuit breaker
    And setting the reset time to 10 ms
    And setting the timeout to 10 ms
    And setting the error threshold to 0
    And setting the volume threshold to 0
    When a call that lasts 10 ms is made
    And I catch TimeoutError
    And time advances by 21 ms
    And a call that lasts 10 ms is made
    Then the circuit should be open

Scenario: Half-Open circuit - [Name]
    
    Given a circuit breaker
    And setting the reset time to 10 ms
    And setting the timeout to 10 ms
    And setting the error threshold to 0
    And setting the volume threshold to 0
    When a call that lasts 10 ms is made
    And I catch TimeoutError
    And time advances by 21 ms
    And one call that [Call] is made
    Then the circuit should be [State]

    Where:
    Name                        |   Call        |   State
    Successful test request     |   succeeds    |   closed
    Failed test request         |   fails       |   open

Scenario: Concurrency - [Name]

    Given a circuit breaker
    And setting the timeout to 10 ms
    And setting the concurrency level to [Level]
    When [Num] calls that last 6 ms are made
    And time advances by 5 ms
    Then there should be [Active] active requests

    Where:
    Name            |   Level   |   Num |   Active
    Under limit     |   5       |   2   |   2
    On the limit    |   5       |   5   |   5
    Over limit      |   5       |   6   |   5
    No Limit        |   0       |   10  |   10

Scenario: Rolling Window - [Name]

    Given a circuit breaker
    And setting the window size to 3000 ms
    And setting the reset time to 1000 ms
    And setting the volume threshold to 0
    And setting the error threshold to 0
    When one call that fails is made
    And time advances by [ms] ms
    Then the circuit should be [State]

    Where:
    Name        |   ms      |   State
    Before roll |   800     |   open
    On roll     |   3000    |   half-open
    After roll  |   4000    |   half-open

Scenario: Rolling Window Count - [Name]

    Given a circuit breaker
    And setting the window size to 1000 ms
    And setting the window count to 5
    And setting the reset time to 0 ms
    And setting the error threshold to 1
    When [ok 1] calls that succeed are made
    And [error 1] calls that fail are made
    And time advances by [ms 1] ms
    When [ok 2] calls that succeed are made
    And [error 2] calls that fail are made
    And time advances by [ms 2] ms
    Then the error percentage is [Percentage]

    Where:
    Name            |   ok 1    |   error 1 |   ms 1    |   ok 2    |   error 2 |   ms 2    |   Percentage
    Before shift    |   9       |   1       |   999     |   0       |   0       |   0       |   .1
    On shift        |   1       |   1       |   1000    |   9       |   1       |   4000    |   .1
    After shift     |   1       |   1       |   1000    |   9       |   1       |   4000    |   .1

Scenario: Errors without name

    Given a circuit breaker
    When one call that fails with not-an-error
    Then the current counts should include one _NoName

Scenario: Interval event - [Name]

    Given a circuit breaker
    And setting the interval size to [size] ms
    When I listen to the interval event
    And [Num] calls that succeed are made
    And time advances by [ms] ms
    Then the listener should have been called [Called] times

    Where:
    Name                            |   size    |   Num |   ms      |   Called
    No requests                     |   500     |   0   |   500     |   0
    With requests before interval   |   500     |   1   |   499     |   0
    With requests on interval       |   500     |   1   |   500     |   1
    With requests after interval    |   500     |   1   |   999     |   1
    With requests after 2 intervals |   500     |   1   |   1000    |   2
    Disabling rolling interval      |   0       |   1   |   1000    |   0

Scenario: Disabling interval event

    Given a circuit breaker
    And setting the interval size to 1000 ms
    And setting the interval event to false
    When I listen to the interval event
    And one call that succeeds is made
    And time advances by 1000 ms
    Then the listener should have been called 0 times

Scenario: Starting the rolling interval - [Name]

    Given a circuit breaker
    And setting the interval size to 1000 ms
    And setting the interval event to true
    When I listen to the interval event
    And I call circuit breaker's startEvents
    And time advances by [ms] ms
    Then the listener should have been called [Called] times

    Where:
    Name                |   ms      |   Called
    Before interval     |   999     |   0
    On interval         |   1000    |   1
    After interval      |   1999    |   1
    After 2 intervals   |   2000    |   2

Scenario: Custom isError handler

    Given a circuit breaker
    And setting a custom isError handler 
    When one call that succeeds is made
    Then the promise fails with MockError

Scenario: Error percentage - [Name]

    Given a circuit breaker
    And setting the timeout to 1 ms
    And setting the error threshold to .2
    And setting the TimeoutError error threshold to .9
    And setting the volume threshold to 0
    When [Num ok] calls that succeed are made
    And [Num timeout] calls that timeout are made
    And [Num error] calls that fail are made catching all errors
    Then the error percentage is [Percentage]
    
    Where:
    Name                |   Num ok  |   Num timeout |   Num error   |   Percentage
    Timeouts            |   9       |   1           |   0           |   .1
    Errors              |   9       |   0           |   1           |   .1
    Errors + Timeouts   |   8       |   1           |   1           |   .2
    OpenCircuitError    |   7       |   0           |   3           |   .3

Scenario: Callback event - [Name]

    Given a circuit breaker
    And setting the timeout to 1000 ms
    And setting the callback event to true
    When I listen to the callback event
    When a call that lasts 100 ms is made
    And time advances by [ms] ms
    Then the callback listener should have been called [Times] times

    Where:
    Name                |   ms      |   Times
    Before callback     |   99      |   0
    On callback         |   100     |   1
    After callback      |   101     |   1

Scenario: Callback event should include arguments and time

    Given a circuit breaker
    And setting the timeout to 1000 ms
    And setting the callback event to true
    When I listen to the callback event
    And I make a call which lasts 100 and remember the expected callback
    And time advances by 100 ms
    Then the callback listener should be called with the correct arguments

Scenario: Callback event should include arguments and time - Error

    Given a circuit breaker
    And setting the timeout to 1000 ms
    And setting the callback event to true
    When I listen to the callback event
    And I make a call which lasts 100 and fails and remember the expected callback
    And time advances by 100 ms
    Then the callback listener should be called with the correct arguments

Scenario: Callback event should not be called on OpenCircuitError

    Given a circuit breaker
    And setting the timeout to 1000 ms
    And setting the callback event to true
    And setting the volume threshold to 0
    And setting the error threshold to 0
    When one call that fails is made
    And I listen to the callback event
    And one call that fails is made
    And I catch OpenCircuitError
    Then the callback listener should have been called 0 times
